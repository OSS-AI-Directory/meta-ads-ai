import { decryptSecret } from '@/lib/crypto';
import {
  getFacebookTokenByUserId,
  markTokenRequiresReauth,
  updateTokenValidation
} from '@/lib/prisma/repositories/facebook';

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? 'v19.0';

export interface TokenValidationResult {
  valid: boolean;
  reason?: 'missing' | 'expired' | 'revoked' | 'unauthorized' | 'unknown';
  accessToken?: string;
}

export async function validateFacebookToken(userId: string) {
  const token = await getFacebookTokenByUserId(userId);
  if (!token) {
    return { valid: false, reason: 'missing' } satisfies TokenValidationResult;
  }

  if (token.requiresReauth) {
    return { valid: false, reason: 'revoked' } satisfies TokenValidationResult;
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    await markTokenRequiresReauth(token.id);
    return { valid: false, reason: 'expired' } satisfies TokenValidationResult;
  }

  const accessToken = decryptSecret(token.accessTokenEncrypted);
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Thiếu cấu hình FACEBOOK_APP_ID hoặc FACEBOOK_APP_SECRET');
  }

  const appAccessToken = `${appId}|${appSecret}`;
  const debugUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`
  );
  debugUrl.searchParams.set('input_token', accessToken);
  debugUrl.searchParams.set('access_token', appAccessToken);

  const debugResponse = await fetch(debugUrl, { cache: 'no-store' });
  const debugJson = (await debugResponse.json()) as {
    data?: {
      is_valid?: boolean;
      expires_at?: number;
      scopes?: string[];
    };
    error?: { message?: string; code?: number };
  };

  if (!debugResponse.ok) {
    await markTokenRequiresReauth(token.id);
    return { valid: false, reason: 'unknown' } satisfies TokenValidationResult;
  }

  if (!debugJson.data?.is_valid) {
    await markTokenRequiresReauth(token.id);
    return {
      valid: false,
      reason: 'unauthorized'
    } satisfies TokenValidationResult;
  }

  if (debugJson.data.expires_at) {
    await updateTokenValidation(token.id, {
      expiresAt: new Date(debugJson.data.expires_at * 1000),
      lastValidatedAt: new Date()
    });
  } else {
    await updateTokenValidation(token.id, { lastValidatedAt: new Date() });
  }

  return { valid: true, accessToken } satisfies TokenValidationResult;
}

export async function ensureValidToken(userId: string) {
  const result = await validateFacebookToken(userId);
  if (!result.valid) {
    throw new Error(result.reason ?? 'Token không hợp lệ');
  }

  return result.accessToken;
}
