import { createHash, createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { parseRefreshTtl, verifyTelegramPayload } from '../domain/security.js';

function telegramPayload(authDate: number, botToken: string) {
  const data: Record<string, unknown> = {
    id: 123456,
    first_name: 'Alice',
    auth_date: authDate,
  };
  const entries = Object.entries(data)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  data.hash = createHmac('sha256', secret).update(entries).digest('hex');
  return data;
}

describe('verifyTelegramPayload', () => {
  const botToken = 'test-bot-token';
  const now = 1_700_000_000;

  it('accepts a valid signature and timestamp', () => {
    expect(verifyTelegramPayload(
      telegramPayload(now, botToken),
      botToken,
      now,
    )).toBe('valid');
  });

  it('rejects an invalid signature', () => {
    const data = telegramPayload(now, botToken);
    data.hash = '00'.repeat(32);
    expect(verifyTelegramPayload(data, botToken, now)).toBe('invalid-signature');
  });

  it('rejects stale authentication', () => {
    expect(verifyTelegramPayload(
      telegramPayload(now - 24 * 60 * 60 - 1, botToken),
      botToken,
      now,
    )).toBe('expired');
  });

  it('rejects future authentication', () => {
    expect(verifyTelegramPayload(
      telegramPayload(now + 5 * 60 + 1, botToken),
      botToken,
      now,
    )).toBe('future');
  });

  it('rejects malformed payloads', () => {
    expect(verifyTelegramPayload({ id: 'bad', auth_date: 'bad', hash: 'bad' }, botToken, now))
      .toBe('malformed');
  });
});

describe('parseRefreshTtl', () => {
  it('parses day and hour durations', () => {
    expect(parseRefreshTtl('12h')).toBe(12 * 60 * 60 * 1000);
    expect(parseRefreshTtl('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects invalid durations', () => {
    expect(() => parseRefreshTtl('30')).toThrow();
    expect(() => parseRefreshTtl('0d')).toThrow();
  });
});
