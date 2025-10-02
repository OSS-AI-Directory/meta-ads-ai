import { auth } from '@clerk/nextjs/server';
import { FacebookInsightLevel } from '@prisma/client';
import { redirect } from 'next/navigation';

import { AdsManagerDashboard } from '@/features/facebook-sync/components/ads-manager-dashboard';
import {
  getAdAccountsByUser,
  getAdsByAccount,
  getAdSetsByAccount,
  getCampaignsByAccount,
  getFacebookTokenByUserId,
  getLatestInsightsByAccountAndLevel
} from '@/lib/prisma/repositories/facebook';

interface PageProps {
  searchParams?: Promise<{
    accountId?: string;
    tab?: string;
  }>;
}

function decimalToNumber(value?: { toString(): string } | null) {
  if (!value) return null;
  return Number(value);
}

function bigIntToNumber(value?: bigint | null) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

export default async function AdsManagerPage({ searchParams }: PageProps) {
  const { userId } = auth();
  if (!userId) {
    redirect('/auth/sign-in');
  }

  const token = await getFacebookTokenByUserId(userId);
  if (!token) {
    redirect('/dashboard/connect-facebook');
  }

  const accounts = await getAdAccountsByUser(userId);

  const params = await searchParams;
  const requestedAccountId = params?.accountId;
  const selectedAccount =
    accounts.find((account) => account.id === requestedAccountId) ??
    accounts[0];
  const selectedAccountId = selectedAccount?.id;

  const requestedTab = params?.tab as
    | 'campaigns'
    | 'adsets'
    | 'ads'
    | undefined;
  const activeTab = requestedTab ?? 'campaigns';

  if (!selectedAccountId) {
    return (
      <AdsManagerDashboard
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          currency: account.currency,
          status: account.status
        }))}
        selectedAccountId={null}
        activeTab={activeTab}
        campaigns={[]}
        adSets={[]}
        ads={[]}
        requiresReauth={token?.requiresReauth ?? false}
      />
    );
  }

  const [
    campaigns,
    adSets,
    ads,
    campaignInsightsMap,
    adSetInsightsMap,
    adInsightsMap
  ] = await Promise.all([
    getCampaignsByAccount(selectedAccountId),
    getAdSetsByAccount(selectedAccountId),
    getAdsByAccount(selectedAccountId),
    getLatestInsightsByAccountAndLevel(
      selectedAccountId,
      FacebookInsightLevel.CAMPAIGN
    ),
    getLatestInsightsByAccountAndLevel(
      selectedAccountId,
      FacebookInsightLevel.ADSET
    ),
    getLatestInsightsByAccountAndLevel(
      selectedAccountId,
      FacebookInsightLevel.AD
    )
  ]);

  const accountCurrency = selectedAccount?.currency ?? 'USD';

  const campaignRows = campaigns.map((campaign) => {
    const insight = campaignInsightsMap.get(campaign.id);
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      spend: insight ? decimalToNumber(insight.spend) : null,
      impressions: insight ? bigIntToNumber(insight.impressions) : null,
      clicks: insight ? bigIntToNumber(insight.clicks) : null,
      cpa: insight ? decimalToNumber(insight.cpa) : null,
      roas: insight ? decimalToNumber(insight.roas) : null,
      purchaseValue: insight ? decimalToNumber(insight.purchaseValue) : null,
      currency: insight?.currency ?? accountCurrency
    };
  });

  const adSetRows = adSets.map((adSet) => {
    const insight = adSetInsightsMap.get(adSet.id);
    return {
      id: adSet.id,
      name: adSet.name,
      status: adSet.status,
      optimizationGoal: adSet.optimizationGoal,
      dailyBudget: decimalToNumber(adSet.dailyBudget),
      lifetimeBudget: decimalToNumber(adSet.lifetimeBudget),
      spend: insight ? decimalToNumber(insight.spend) : null,
      impressions: insight ? bigIntToNumber(insight.impressions) : null,
      clicks: insight ? bigIntToNumber(insight.clicks) : null,
      cpa: insight ? decimalToNumber(insight.cpa) : null,
      roas: insight ? decimalToNumber(insight.roas) : null,
      purchaseValue: insight ? decimalToNumber(insight.purchaseValue) : null,
      currency: insight?.currency ?? accountCurrency
    };
  });

  const adRows = ads.map((ad) => {
    const insight = adInsightsMap.get(ad.id);
    return {
      id: ad.id,
      name: ad.name,
      status: ad.status,
      spend: insight ? decimalToNumber(insight.spend) : null,
      impressions: insight ? bigIntToNumber(insight.impressions) : null,
      clicks: insight ? bigIntToNumber(insight.clicks) : null,
      cpa: insight ? decimalToNumber(insight.cpa) : null,
      roas: insight ? decimalToNumber(insight.roas) : null,
      purchaseValue: insight ? decimalToNumber(insight.purchaseValue) : null,
      currency: insight?.currency ?? accountCurrency
    };
  });

  return (
    <AdsManagerDashboard
      accounts={accounts.map((account) => ({
        id: account.id,
        name: account.name,
        currency: account.currency,
        status: account.status
      }))}
      selectedAccountId={selectedAccountId}
      activeTab={activeTab}
      campaigns={campaignRows}
      adSets={adSetRows}
      ads={adRows}
      requiresReauth={token?.requiresReauth ?? false}
    />
  );
}
