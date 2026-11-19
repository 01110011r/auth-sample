import { createHash, createHmac, timingSafeEqual } from 'crypto';

export function verifyTelegramPayload(
  data: Record<string, unknown>,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (
    !Number.isSafeInteger(data.id) ||
    typeof data.hash !== 'string' ||
    !Number.isSafeInteger(data.auth_date)
  ) {
    return 'malformed';
  }

  const authDate = data.auth_date as number;
  if (authDate < nowSeconds - 24 * 60 * 60) return 'expired';
  if (authDate > nowSeconds + 5 * 60) return 'future';

  const entries = Object.entries(data)
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(entries).digest();
  const supplied = Buffer.from(data.hash as string, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return 'invalid-signature';
  }
  return 'valid';
}

export function parseRefreshTtl(ttl: string): number {
  const match = /^([1-9]\d*)([dh])$/.exec(ttl);
  if (!match) throw new Error('JWT_REFRESH_TTL must use a duration such as 30d or 24h');
  const value = Number(match[1]);
  if (!Number.isSafeInteger(value)) {
    throw new Error('JWT_REFRESH_TTL is too large');
  }
  return value * (match[2] === 'd' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000);
}
