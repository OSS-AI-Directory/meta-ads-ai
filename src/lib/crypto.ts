import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;

function resolveKey(): Buffer {
  const secret = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('FACEBOOK_TOKEN_ENCRYPTION_KEY is not configured');
  }

  const maybeBase64 = Buffer.from(secret, 'base64');
  if (maybeBase64.length === KEY_LENGTH) {
    return maybeBase64;
  }

  if (secret.length === KEY_LENGTH) {
    return Buffer.from(secret);
  }

  throw new Error(
    'FACEBOOK_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or utf-8 string'
  );
}

export function encryptSecret(value: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = resolveKey();
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}
