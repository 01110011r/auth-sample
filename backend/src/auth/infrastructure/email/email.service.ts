import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly config: ConfigService) {}

  async sendVerification(email: string, token: string) {
    void email;
    void token;
    this.logger.log('Email verification message queued');
  }

  async sendPasswordReset(email: string, token: string) {
    void email;
    void token;
    this.logger.log('Password reset message queued');
  }
}
