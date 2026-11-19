import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategyProvider, FacebookStrategyProvider } from './social.strategy.js';

describe('social provider verification', () => {
  const googleConfig = new ConfigService({
    GOOGLE_CLIENT_ID: 'google-client',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:4000/auth/google/callback',
  });
  const facebookConfig = new ConfigService({
    FACEBOOK_APP_ID: 'facebook-client',
    FACEBOOK_APP_SECRET: 'facebook-secret',
    FACEBOOK_CALLBACK_URL: 'http://localhost:4000/auth/facebook/callback',
  });

  it('accepts Google with a verified email', () => {
    const strategy = new GoogleStrategyProvider(googleConfig);
    const profile = {
      id: 'google-123',
      displayName: 'Alice',
      provider: 'google',
      profileUrl: 'https://example.com',
      emails: [{ value: 'alice@example.com', verified: true }],
      _raw: '{}',
      _json: { iss: 'accounts.google.com', aud: 'google-client', sub: 'google-123', email_verified: true },
      photos: [],
    } as any;
    expect(strategy.validate('', '', profile).emailVerified).toBe(true);
  });

  it('rejects Google without verified email', () => {
    const strategy = new GoogleStrategyProvider(googleConfig);
    const profile = {
      id: 'google-123',
      displayName: 'Alice',
      provider: 'google',
      emails: [{ value: 'alice@example.com', verified: false }],
      _raw: '{}',
      _json: { iss: 'accounts.google.com', aud: 'google-client', sub: 'google-123', email_verified: false },
    } as any;
    expect(() => strategy.validate('', '', profile)).toThrow();
  });

  it('accepts Facebook when Graph returns an email through the email scope', () => {
    const strategy = new FacebookStrategyProvider(facebookConfig);
    const profile = {
      id: 'facebook-123',
      displayName: 'Alice',
      provider: 'facebook',
      emails: [{ value: 'alice@example.com' }],
      _raw: '{}',
      _json: { email: 'alice@example.com' },
    } as any;
    expect(strategy.validate('', '', profile).emailVerified).toBe(true);
  });

  it('rejects Facebook when no email is returned', () => {
    const strategy = new FacebookStrategyProvider(facebookConfig);
    const profile = {
      id: 'facebook-123',
      displayName: 'Alice',
      provider: 'facebook',
      emails: undefined,
      _raw: '{}',
      _json: {},
    } as any;
    expect(() => strategy.validate('', '', profile)).toThrow(/email permission/i);
  });
});
