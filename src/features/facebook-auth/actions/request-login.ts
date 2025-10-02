'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes, createHash } from 'crypto';

import { auth } from '@clerk/nextjs/server';

const STATE_COOKIE = 'fb_oauth_state';
const CODE_VERIFIER_COOKIE = 'fb_oauth_code_verifier';
const DEFAULT_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'read_insights'
];

function base64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function createFacebookLoginRedirect() {
  const { userId } = auth();
  if (!userId) {
    redirect('/auth/sign-in');
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !redirectUri) {
    throw new Error('Chưa cấu hình FACEBOOK_APP_ID hoặc FACEBOOK_REDIRECT_URI');
  }

  const configuredScopes = process.env.FACEBOOK_APP_SCOPES?.split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  const scopes = configuredScopes?.length ? configuredScopes : DEFAULT_SCOPES;
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(
    createHash('sha256').update(codeVerifier).digest()
  );

  const cookieStore = cookies();
  const maxAge = 60 * 10; // 10 phút
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge
  });
  cookieStore.set(CODE_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge
  });

  const url = new URL(`https://www.facebook.com/dialog/oauth`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  redirect(url.toString());
}

export function clearFacebookOauthCookies() {
  const cookieStore = cookies();
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(CODE_VERIFIER_COOKIE);
}
