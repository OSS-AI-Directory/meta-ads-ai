import { FacebookInsightLevel, SyncJobStatus } from '@prisma/client';

import {
  bulkUpsertAdAccounts,
  bulkUpsertAdSets,
  bulkUpsertAds,
  bulkUpsertCampaigns,
  bulkUpsertInsights,
  createSyncJob,
  updateSyncJob,
  type PrismaClientLike
} from '@/lib/prisma/repositories/facebook';

import type { FacebookApiClient } from '@/features/facebook-sync/services/facebook-api';

export interface RefreshFacebookDataParams {
  userId: string;
  tokenId: string;
  api: FacebookApiClient;
  since?: Date;
  markInitialSync?: boolean;
  client?: PrismaClientLike;
}

export interface RefreshFacebookDataResult {
  accounts: number;
  campaigns: number;
  adSets: number;
  ads: number;
  insights: number;
}

export async function refreshFacebookData({
  userId,
  tokenId,
  api,
  since,
  markInitialSync = false,
  client
}: RefreshFacebookDataParams): Promise<RefreshFacebookDataResult> {
  const timestamp = markInitialSync ? new Date() : undefined;
  const accounts = await api.fetchAdAccounts();

  await bulkUpsertAdAccounts(
    accounts.map((account) => ({
      id: account.id,
      userId,
      tokenId,
      name: account.name,
      currency: account.currency,
      status: account.status,
      timezoneName: account.timezoneName,
      initialSyncCompletedAt: timestamp
    })),
    client
  );

  let campaignTotal = 0;
  let adSetTotal = 0;
  let adTotal = 0;
  let insightTotal = 0;

  for (const account of accounts) {
    const campaigns = await api.fetchCampaigns(account.id);
    campaignTotal += campaigns.length;

    await bulkUpsertCampaigns(
      campaigns.map((campaign) => ({
        id: campaign.id,
        accountId: account.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        buyingType: campaign.buyingType,
        startTime: campaign.startTime ?? undefined,
        stopTime: campaign.stopTime ?? undefined
      })),
      client
    );

    const adSets = await api.fetchAdSets(account.id);
    adSetTotal += adSets.length;

    await bulkUpsertAdSets(
      adSets.map((adSet) => ({
        id: adSet.id,
        accountId: account.id,
        campaignId: adSet.campaignId,
        name: adSet.name,
        status: adSet.status,
        optimizationGoal: adSet.optimizationGoal,
        dailyBudget: adSet.dailyBudget,
        lifetimeBudget: adSet.lifetimeBudget,
        startTime: adSet.startTime ?? undefined,
        endTime: adSet.endTime ?? undefined
      })),
      client
    );

    const ads = await api.fetchAds(account.id);
    adTotal += ads.length;

    await bulkUpsertAds(
      ads.map((ad) => ({
        id: ad.id,
        accountId: account.id,
        campaignId: ad.campaignId,
        adSetId: ad.adSetId,
        name: ad.name,
        status: ad.status,
        creativeId: ad.creativeId ?? undefined
      })),
      client
    );

    const campaignInsights = await api.fetchInsights(account.id, 'campaign', {
      since
    });

    const adSetInsights = await api.fetchInsights(account.id, 'adset', {
      since
    });

    const adInsights = await api.fetchInsights(account.id, 'ad', {
      since
    });

    insightTotal +=
      campaignInsights.length + adSetInsights.length + adInsights.length;

    await bulkUpsertInsights(
      campaignInsights.map((insight) => ({
        accountId: account.id,
        entityId: insight.entityId,
        level: FacebookInsightLevel.CAMPAIGN,
        date: insight.date,
        spend: insight.spend,
        impressions: insight.impressions
          ? parseInt(insight.impressions, 10)
          : undefined,
        clicks: insight.clicks ? parseInt(insight.clicks, 10) : undefined,
        cpa: insight.cpa,
        roas: insight.roas,
        purchaseValue: insight.purchaseValue,
        currency: insight.currency
      })),
      client
    );

    await bulkUpsertInsights(
      adSetInsights.map((insight) => ({
        accountId: account.id,
        entityId: insight.entityId,
        level: FacebookInsightLevel.ADSET,
        date: insight.date,
        spend: insight.spend,
        impressions: insight.impressions
          ? parseInt(insight.impressions, 10)
          : undefined,
        clicks: insight.clicks ? parseInt(insight.clicks, 10) : undefined,
        cpa: insight.cpa,
        roas: insight.roas,
        purchaseValue: insight.purchaseValue,
        currency: insight.currency
      })),
      client
    );

    await bulkUpsertInsights(
      adInsights.map((insight) => ({
        accountId: account.id,
        entityId: insight.entityId,
        level: FacebookInsightLevel.AD,
        date: insight.date,
        spend: insight.spend,
        impressions: insight.impressions
          ? parseInt(insight.impressions, 10)
          : undefined,
        clicks: insight.clicks ? parseInt(insight.clicks, 10) : undefined,
        cpa: insight.cpa,
        roas: insight.roas,
        purchaseValue: insight.purchaseValue,
        currency: insight.currency
      })),
      client
    );
  }

  return {
    accounts: accounts.length,
    campaigns: campaignTotal,
    adSets: adSetTotal,
    ads: adTotal,
    insights: insightTotal
  };
}

export async function runRefreshJob(
  params: RefreshFacebookDataParams
): Promise<RefreshFacebookDataResult> {
  const job = await createSyncJob(
    {
      userId: params.userId,
      tokenId: params.tokenId,
      status: SyncJobStatus.RUNNING
    },
    params.client
  );

  try {
    const result = await refreshFacebookData(params);
    await updateSyncJob(
      job.id,
      { status: SyncJobStatus.SUCCESS, finishedAt: new Date() },
      params.client
    );
    return result;
  } catch (error) {
    await updateSyncJob(
      job.id,
      {
        status: SyncJobStatus.FAILED,
        errorPayload: { message: (error as Error).message },
        finishedAt: new Date()
      },
      params.client
    );
    throw error;
  }
}
