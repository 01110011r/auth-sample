import { plainToInstance, Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  IsIn,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d*[dh]$/, {
    message: 'JWT_REFRESH_TTL must use a positive duration such as 30d or 24h',
  })
  JWT_REFRESH_TTL = '30d';

  @IsUrl({ require_tld: false })
  FRONTEND_URL = 'http://localhost:3000';

  @Transform(({ value }) => (value === undefined ? 4000 : Number(value)))
  @IsInt()
  @Min(1)
  PORT = 4000;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  GOOGLE_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  FACEBOOK_APP_ID?: string;

  @IsOptional()
  @IsString()
  FACEBOOK_APP_SECRET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  FACEBOOK_CALLBACK_URL?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_TOKEN?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_USERNAME?: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_WEBHOOK_SECRET?: string;

  @IsString()
  CORS_ORIGINS = '';

  @Transform(({ value }) => value === 'true')
  @IsOptional()
  COOKIE_SECURE = false;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  @IsString()
  @IsOptional()
  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAME_SITE: 'lax' | 'strict' | 'none' = 'lax';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed: ${errors
        .map((error) => Object.values(error.constraints ?? {}).join(', '))
        .join('; ')}`,
    );
  }
  return environment;
}
