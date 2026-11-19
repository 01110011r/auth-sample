import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type DiscoveryDocument = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type TelegramOidcClaims = {
  sub: string;
  name?: string;
  preferred_username?: string;
  phone_number?: string;
  picture?: string;
  nonce?: string;
};

@Injectable()
export class TelegramOidcService {
  private discovery?: DiscoveryDocument;

  constructor(private readonly config: ConfigService) {}

  private async getDiscovery() {
    if (this.discovery) return this.discovery;
    const response = await fetch(
      'https://oauth.telegram.org/.well-known/openid-configuration',
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException('Telegram OIDC discovery is unavailable');
    }
    const discovery = await response.json() as DiscoveryDocument;
    if (
      discovery.issuer !== 'https://oauth.telegram.org' ||
      !discovery.authorization_endpoint ||
      !discovery.token_endpoint ||
      !discovery.jwks_uri
    ) {
      throw new ServiceUnavailableException('Telegram OIDC configuration is invalid');
    }
    this.discovery = discovery;
    return discovery;
  }

  createAuthorization(req: any) {
    const clientId = this.config.get<string>('TELEGRAM_CLIENT_ID');
    if (!clientId) {
      throw new ServiceUnavailableException('Telegram OIDC is not configured');
    }
    const redirectUri =
      this.config.get<string>('TELEGRAM_REDIRECT_URI') ??
      'http://localhost:4000/auth/telegram/oidc/callback';

    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    req.session.telegramOidc = {
      state,
      nonce,
      codeVerifier,
    };

    return this.getDiscovery().then((discovery) => {
      const url = new URL(discovery.authorization_endpoint);
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_url', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid profile phone');
      url.searchParams.set('state', state);
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');
      return url.toString();
    });
  }

  async exchangeCallback(
    req: any,
    code: string,
    state: string,
  ): Promise<TelegramOidcClaims> {
    const clientId = this.config.get<string>('TELEGRAM_CLIENT_ID');
    const clientSecret = this.config.get<string>('TELEGRAM_CLIENT_SECRET');
    if (!clientId) {
      throw new ServiceUnavailableException('Telegram OIDC is not configured');
    }

    const stored = req.session?.telegramOidc as
      | { state: string; nonce: string; codeVerifier: string }
      | undefined;
    if (
      !stored ||
      stored.state.length !== state.length ||
      !Buffer.from(stored.state).equals(Buffer.from(state))
    ) {
      throw new UnauthorizedException('Telegram OIDC state is invalid');
    }

    const discovery = await this.getDiscovery();
    const redirectUri =
      this.config.get<string>('TELEGRAM_REDIRECT_URI') ??
      'http://localhost:4000/auth/telegram/oidc/callback';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_url: redirectUri,
      client_id: clientId,
      code_verifier: stored.codeVerifier,
    });
    if (clientSecret) body.set('client_secret', clientSecret);

    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Telegram OIDC code exchange failed');
    }
    const token = await tokenResponse.json() as {
      id_token?: string;
      error?: string;
    };
    if (!token.id_token) {
      throw new UnauthorizedException('Telegram OIDC did not return an id_token');
    }

    const remoteJwks = createRemoteJWKSet(new URL(discovery.jwks_uri), {
      timeoutDuration: 10_000,
    });
    const { payload } = await jwtVerify(token.id_token, remoteJwks, {
      issuer: discovery.issuer,
      audience: clientId,
      algorithms: ['RS256'],
      requiredClaims: ['sub'],
    }).catch(() => {
      throw new UnauthorizedException('Telegram OIDC id_token verification failed');
    });

    if (
      typeof payload.nonce !== 'string' ||
      payload.nonce.length !== stored.nonce.length ||
      !Buffer.from(payload.nonce).equals(Buffer.from(stored.nonce))
    ) {
      throw new UnauthorizedException('Telegram OIDC nonce is invalid');
    }

    delete req.session.telegramOidc;
    return {
      sub: payload.sub as string,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      preferred_username:
        typeof payload.preferred_username === 'string'
          ? payload.preferred_username
          : undefined,
      phone_number:
        typeof payload.phone_number === 'string'
          ? payload.phone_number
          : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  }
}
