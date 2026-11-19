import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  refreshToken?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class TelegramAuthDto {
  @IsInt()
  id!: number;

  @IsString()
  @IsNotEmpty()
  hash!: string;

  @IsInt()
  auth_date!: number;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsOptional()
  @IsString()
  username?: string;
}

export class TelegramOtpRequestDto extends TelegramAuthDto {}

export class TelegramOtpVerifyDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
