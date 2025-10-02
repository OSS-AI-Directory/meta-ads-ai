import {
  FacebookInsightLevel,
  SyncJobStatus,
  type Prisma,
  type FacebookAd,
  type FacebookAdAccount,
  type FacebookAdSet,
  type FacebookCampaign,
  type FacebookInsight,
  type FacebookToken,
  type SyncJob
} from '@prisma/client';

import { prisma, type PrismaTransactionClient } from '@/lib/prisma/client';

export type PrismaClientLike = typeof prisma | PrismaTransactionClient;

function getClient(client?: PrismaClientLike): PrismaClientLike {
  return client ?? prisma;
}

function toDecimal(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return undefined;

  return new Prisma.Decimal(value);
}

export interface UpsertFacebookTokenInput {
  userId: string;
  adAccountIds: string[];
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string | null;
  expiresAt: Date;
  lastValidatedAt?: Date | null;
  requiresReauth?: boolean;
}

export async function upsertFacebookToken(
  input: UpsertFacebookTokenInput,
  client?: PrismaClientLike
): Promise<FacebookToken> {
  const db = getClient(client);
  const { requiresReauth = false, ...rest } = input;

  return db.facebookToken.upsert({
    where: { userId: rest.userId },
    update: {
      adAccountIds: rest.adAccountIds,
      accessTokenEncrypted: rest.accessTokenEncrypted,
      refreshTokenEncrypted: rest.refreshTokenEncrypted ?? undefined,
      expiresAt: rest.expiresAt,
      lastValidatedAt: rest.lastValidatedAt ?? new Date(),
      requiresReauth
    },
    create: {
      userId: rest.userId,
      adAccountIds: rest.adAccountIds,
      accessTokenEncrypted: rest.accessTokenEncrypted,
      refreshTokenEncrypted: rest.refreshTokenEncrypted ?? undefined,
      expiresAt: rest.expiresAt,
      lastValidatedAt: rest.lastValidatedAt ?? new Date(),
      requiresReauth
    }
  });
}

export function getFacebookTokenByUserId(
  userId: string,
  client?: PrismaClientLike
) {
  return getClient(client).facebookToken.findUnique({
    where: { userId }
  });
}

export async function markTokenRequiresReauth(
  tokenId: string,
  client?: PrismaClientLike
) {
  const db = getClient(client);

  await db.facebookToken.update({
    where: { id: tokenId },
    data: {
      requiresReauth: true,
      lastValidatedAt: new Date()
    }
  });
}

export async function updateTokenValidation(
  tokenId: string,
  data: { expiresAt?: Date; lastValidatedAt?: Date },
  client?: PrismaClientLike
) {
  const db = getClient(client);

  await db.facebookToken.update({
    where: { id: tokenId },
    data: {
      expiresAt: data.expiresAt,
      lastValidatedAt: data.lastValidatedAt ?? new Date(),
      requiresReauth: false
    }
  });
}

export interface UpsertAdAccountInput {
  id: string;
  userId: string;
  tokenId?: string | null;
  name: string;
  currency?: string | null;
  status?: string | null;
  timezoneName?: string | null;
  initialSyncCompletedAt?: Date | null;
}

export async function bulkUpsertAdAccounts(
  accounts: UpsertAdAccountInput[],
  client?: PrismaClientLike
): Promise<FacebookAdAccount[]> {
  if (!accounts.length) return [];

  const db = getClient(client);

  const operations = accounts.map((account) =>
    db.facebookAdAccount.upsert({
      where: { id: account.id },
      update: {
        name: account.name,
        userId: account.userId,
        currency: account.currency ?? undefined,
        status: account.status ?? undefined,
        timezoneName: account.timezoneName ?? undefined,
        initialSyncCompletedAt: account.initialSyncCompletedAt ?? undefined,
        tokenId: account.tokenId ?? undefined
      },
      create: {
        id: account.id,
        userId: account.userId,
        tokenId: account.tokenId ?? undefined,
        name: account.name,
        currency: account.currency ?? undefined,
        status: account.status ?? undefined,
        timezoneName: account.timezoneName ?? undefined,
        initialSyncCompletedAt: account.initialSyncCompletedAt ?? undefined
      }
    })
  );

  return db.$transaction(operations);
}

export interface UpsertCampaignInput {
  id: string;
  accountId: string;
  name: string;
  status?: string | null;
  objective?: string | null;
  buyingType?: string | null;
  startTime?: Date | null;
  stopTime?: Date | null;
}

export async function bulkUpsertCampaigns(
  campaigns: UpsertCampaignInput[],
  client?: PrismaClientLike
): Promise<FacebookCampaign[]> {
  if (!campaigns.length) return [];

  const db = getClient(client);

  const operations = campaigns.map((campaign) =>
    db.facebookCampaign.upsert({
      where: { id: campaign.id },
      update: {
        accountId: campaign.accountId,
        name: campaign.name,
        status: campaign.status ?? undefined,
        objective: campaign.objective ?? undefined,
        buyingType: campaign.buyingType ?? undefined,
        startTime: campaign.startTime ?? undefined,
        stopTime: campaign.stopTime ?? undefined
      },
      create: {
        id: campaign.id,
        accountId: campaign.accountId,
        name: campaign.name,
        status: campaign.status ?? undefined,
        objective: campaign.objective ?? undefined,
        buyingType: campaign.buyingType ?? undefined,
        startTime: campaign.startTime ?? undefined,
        stopTime: campaign.stopTime ?? undefined
      }
    })
  );

  return db.$transaction(operations);
}

export interface UpsertAdSetInput {
  id: string;
  accountId: string;
  campaignId?: string | null;
  name: string;
  status?: string | null;
  optimizationGoal?: string | null;
  dailyBudget?: number | string | null;
  lifetimeBudget?: number | string | null;
  startTime?: Date | null;
  endTime?: Date | null;
}

export async function bulkUpsertAdSets(
  adSets: UpsertAdSetInput[],
  client?: PrismaClientLike
): Promise<FacebookAdSet[]> {
  if (!adSets.length) return [];

  const db = getClient(client);

  const operations = adSets.map((adSet) =>
    db.facebookAdSet.upsert({
      where: { id: adSet.id },
      update: {
        accountId: adSet.accountId,
        campaignId: adSet.campaignId ?? undefined,
        name: adSet.name,
        status: adSet.status ?? undefined,
        optimizationGoal: adSet.optimizationGoal ?? undefined,
        dailyBudget: toDecimal(adSet.dailyBudget),
        lifetimeBudget: toDecimal(adSet.lifetimeBudget),
        startTime: adSet.startTime ?? undefined,
        endTime: adSet.endTime ?? undefined
      },
      create: {
        id: adSet.id,
        accountId: adSet.accountId,
        campaignId: adSet.campaignId ?? undefined,
        name: adSet.name,
        status: adSet.status ?? undefined,
        optimizationGoal: adSet.optimizationGoal ?? undefined,
        dailyBudget: toDecimal(adSet.dailyBudget),
        lifetimeBudget: toDecimal(adSet.lifetimeBudget),
        startTime: adSet.startTime ?? undefined,
        endTime: adSet.endTime ?? undefined
      }
    })
  );

  return db.$transaction(operations);
}

export interface UpsertAdInput {
  id: string;
  accountId: string;
  campaignId?: string | null;
  adSetId?: string | null;
  name: string;
  status?: string | null;
  creativeId?: string | null;
}

export async function bulkUpsertAds(
  ads: UpsertAdInput[],
  client?: PrismaClientLike
): Promise<FacebookAd[]> {
  if (!ads.length) return [];

  const db = getClient(client);

  const operations = ads.map((ad) =>
    db.facebookAd.upsert({
      where: { id: ad.id },
      update: {
        accountId: ad.accountId,
        campaignId: ad.campaignId ?? undefined,
        adSetId: ad.adSetId ?? undefined,
        name: ad.name,
        status: ad.status ?? undefined,
        creativeId: ad.creativeId ?? undefined
      },
      create: {
        id: ad.id,
        accountId: ad.accountId,
        campaignId: ad.campaignId ?? undefined,
        adSetId: ad.adSetId ?? undefined,
        name: ad.name,
        status: ad.status ?? undefined,
        creativeId: ad.creativeId ?? undefined
      }
    })
  );

  return db.$transaction(operations);
}

export interface UpsertInsightInput {
  accountId: string;
  entityId: string;
  level: FacebookInsightLevel;
  date: Date;
  spend?: number | string | null;
  impressions?: number | bigint | null;
  clicks?: number | bigint | null;
  cpa?: number | string | null;
  roas?: number | string | null;
  purchaseValue?: number | string | null;
  currency?: string | null;
}

export async function bulkUpsertInsights(
  insights: UpsertInsightInput[],
  client?: PrismaClientLike
): Promise<FacebookInsight[]> {
  if (!insights.length) return [];

  const db = getClient(client);

  const operations = insights.map((insight) =>
    db.facebookInsight.upsert({
      where: {
        accountId_entityId_level_date: {
          accountId: insight.accountId,
          entityId: insight.entityId,
          level: insight.level,
          date: insight.date
        }
      },
      update: {
        spend: toDecimal(insight.spend) ?? new Prisma.Decimal(0),
        impressions: insight.impressions ?? 0,
        clicks: insight.clicks ?? 0,
        cpa: toDecimal(insight.cpa),
        roas: toDecimal(insight.roas),
        purchaseValue: toDecimal(insight.purchaseValue),
        currency: insight.currency ?? undefined
      },
      create: {
        accountId: insight.accountId,
        entityId: insight.entityId,
        level: insight.level,
        date: insight.date,
        spend: toDecimal(insight.spend) ?? new Prisma.Decimal(0),
        impressions: insight.impressions ?? 0,
        clicks: insight.clicks ?? 0,
        cpa: toDecimal(insight.cpa),
        roas: toDecimal(insight.roas),
        purchaseValue: toDecimal(insight.purchaseValue),
        currency: insight.currency ?? undefined
      }
    })
  );

  return db.$transaction(operations);
}

export function getAdAccountsByUser(userId: string, client?: PrismaClientLike) {
  return getClient(client).facebookAdAccount.findMany({
    where: { userId },
    orderBy: { name: 'asc' }
  });
}

export function getCampaignsByAccount(
  accountId: string,
  client?: PrismaClientLike
) {
  return getClient(client).facebookCampaign.findMany({
    where: { accountId },
    orderBy: { name: 'asc' }
  });
}

export function getAdSetsByAccount(
  accountId: string,
  client?: PrismaClientLike
) {
  return getClient(client).facebookAdSet.findMany({
    where: { accountId },
    orderBy: { name: 'asc' }
  });
}

export function getAdsByAccount(accountId: string, client?: PrismaClientLike) {
  return getClient(client).facebookAd.findMany({
    where: { accountId },
    orderBy: { name: 'asc' }
  });
}

export async function getLatestInsightsByAccountAndLevel(
  accountId: string,
  level: FacebookInsightLevel,
  options: { maxEntities?: number } = {},
  client?: PrismaClientLike
) {
  const { maxEntities = 250 } = options;
  const db = getClient(client);
  const records = await db.facebookInsight.findMany({
    where: { accountId, level },
    orderBy: [{ entityId: 'asc' }, { date: 'desc' }],
    take: maxEntities * 5
  });

  const map = new Map<string, FacebookInsight>();
  for (const record of records) {
    if (!map.has(record.entityId)) {
      map.set(record.entityId, record);
      if (map.size >= maxEntities) break;
    }
  }

  return map;
}

export interface CreateSyncJobInput {
  userId: string;
  tokenId?: string | null;
  status?: SyncJobStatus;
  startedAt?: Date;
}

export async function createSyncJob(
  input: CreateSyncJobInput,
  client?: PrismaClientLike
): Promise<SyncJob> {
  const db = getClient(client);

  return db.syncJob.create({
    data: {
      userId: input.userId,
      tokenId: input.tokenId ?? undefined,
      status: input.status ?? SyncJobStatus.PENDING,
      startedAt: input.startedAt ?? new Date()
    }
  });
}

export async function updateSyncJob(
  jobId: string,
  data: Partial<Pick<SyncJob, 'status' | 'errorPayload' | 'finishedAt'>>,
  client?: PrismaClientLike
): Promise<SyncJob> {
  const db = getClient(client);

  return db.syncJob.update({
    where: { id: jobId },
    data: {
      status: data.status,
      errorPayload: data.errorPayload,
      finishedAt:
        data.finishedAt ??
        (data.status && data.status !== SyncJobStatus.RUNNING
          ? new Date()
          : undefined)
    }
  });
}

export function getTokensEligibleForRefresh(
  reference: Date,
  client?: PrismaClientLike
) {
  return getClient(client).facebookToken.findMany({
    where: {
      requiresReauth: false,
      expiresAt: { gt: reference }
    }
  });
}

export function getTokensNeedingReauth(client?: PrismaClientLike) {
  return getClient(client).facebookToken.findMany({
    where: {
      OR: [{ requiresReauth: true }, { expiresAt: { lte: new Date() } }]
    }
  });
}
