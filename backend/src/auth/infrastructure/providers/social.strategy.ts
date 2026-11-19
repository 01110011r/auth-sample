import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Profile as GoogleProfile, Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Profile as FacebookProfile, Strategy as FacebookStrategy } from 'passport-facebook';

export type SocialProfile = {
  provider: 'GOOGLE' | 'FACEBOOK';
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified: boolean;
};

@Injectable()
export class GoogleStrategyProvider extends PassportStrategy(GoogleStrategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') || 'disabled',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') || 'disabled',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
      state: true,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: GoogleProfile,
  ): SocialProfile {
    const email = profile.emails?.[0]?.value;
    const emailVerified =
      profile.emails?.[0]?.verified === true ||
      profile._json.email_verified === true;
    if (!email || !emailVerified) {
      throw new UnauthorizedException('Google account email is missing or unverified');
    }
    return {
      provider: 'GOOGLE',
      providerId: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
    };
  }
}

@Injectable()
export class FacebookStrategyProvider extends PassportStrategy(FacebookStrategy, 'facebook') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('FACEBOOK_APP_ID') || 'disabled',
      clientSecret: config.get<string>('FACEBOOK_APP_SECRET') || 'disabled',
      callbackURL: config.get<string>('FACEBOOK_CALLBACK_URL') ??
        'http://localhost:4000/auth/facebook/callback',
      scope: ['email', 'public_profile'],
      profileFields: ['id', 'displayName', 'emails', 'photos'],
      state: true,
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: FacebookProfile,
  ): SocialProfile {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new UnauthorizedException(
        'Facebook account email is missing. Grant and approve the email permission.',
      );
    }
    return {
      provider: 'FACEBOOK',
      providerId: profile.id,
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      emailVerified: true,
    };
  }
}
