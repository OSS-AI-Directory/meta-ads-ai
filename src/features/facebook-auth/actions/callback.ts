'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { auth } from '@clerk/nextjs/server';

import { encryptSecret } from '@/lib/crypto';
import {
  bulkUpsertAdAccounts,
  upsertFacebookToken
} from '@/lib/prisma/repositories/facebook';

import { createFacebookApiClient } from '@/features/facebook-sync/services/facebook-api';
import { refreshFacebookData } from '@/features/facebook-sync/workers/refresh.worker';

const STATE_COOKIE = 'fb_oauth_state';
const CODE_VERIFIER_COOKIE = 'fb_oauth_code_verifier';
const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? 'v19.0';

const callbackSchema = z.object({
  code: z.string(),
  state: z.string()
});

interface ExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  data_access_expires_at?: number;
  machine_id?: string;
}

interface LongLivedResponse {
  access_token: string;
  expires_in?: number;
  token_type?: string;
}

export async function handleFacebookCallback(searchParams: {
  code?: string | null;
  state?: string | null;
}) {
  const { userId } = auth();
  if (!userId) {
    redirect('/auth/sign-in');
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Thiếu cấu hình Facebook OAuth');
  }

  const parsed = callbackSchema.parse(searchParams);

  const cookieStore = cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(CODE_VERIFIER_COOKIE)?.value;

  if (!savedState || savedState !== parsed.state) {
    throw new Error('Trạng thái OAuth không hợp lệ');
  }

  if (!codeVerifier) {
    throw new Error('Thiếu mã code verifier cho OAuth');
  }

  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(CODE_VERIFIER_COOKIE);

  const exchangeParams = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code: parsed.code,
    code_verifier: codeVerifier
  });

  const tokenResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
    {
      method: 'POST',
      body: exchangeParams,
      cache: 'no-store'
    }
  );

  const tokenJson = (await tokenResponse.json()) as ExchangeResponse & {
    error?: { message?: string };
  };

  if (!tokenResponse.ok) {
    throw new Error(
      tokenJson.error?.message ?? 'Không thể đổi mã truy cập Facebook'
    );
  }

  let accessToken = tokenJson.access_token;
  let expiresIn = tokenJson.expires_in;

  const longLivedParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken
  });

  const longLivedResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?${longLivedParams.toString()}`,
    { cache: 'no-store' }
  );

  if (longLivedResponse.ok) {
    const longLivedJson = (await longLivedResponse.json()) as LongLivedResponse;
    if (longLivedJson.access_token) {
      accessToken = longLivedJson.access_token;
    }
    if (longLivedJson.expires_in) {
      expiresIn = longLivedJson.expires_in;
    }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const apiClient = createFacebookApiClient(accessToken);
  const accounts = await apiClient.fetchAdAccounts();

  const tokenRecord = await upsertFacebookToken({
    userId,
    adAccountIds: accounts.map((account) => account.id),
    accessTokenEncrypted: encryptSecret(accessToken),
    expiresAt,
    lastValidatedAt: new Date()
  });

  await bulkUpsertAdAccounts(
    accounts.map((account) => ({
      id: account.id,
      userId,
      tokenId: tokenRecord.id,
      name: account.name,
      currency: account.currency,
      status: account.status,
      timezoneName: account.timezoneName,
      initialSyncCompletedAt: undefined
    }))
  );

  await refreshFacebookData({
    userId,
    tokenId: tokenRecord.id,
    api: apiClient,
    markInitialSync: true
  });

  redirect('/dashboard/ads-manager');
}
