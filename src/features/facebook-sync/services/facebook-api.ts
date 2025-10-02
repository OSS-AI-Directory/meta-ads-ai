const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? 'v19.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface FacebookAdAccountResponse {
  id: string;
  accountId: string;
  name: string;
  currency?: string;
  status?: string;
  timezoneName?: string;
}

export interface FacebookCampaignResponse {
  id: string;
  accountId: string;
  name: string;
  status?: string;
  objective?: string;
  buyingType?: string;
  startTime?: Date | null;
  stopTime?: Date | null;
}

export interface FacebookAdSetResponse {
  id: string;
  accountId: string;
  campaignId?: string | null;
  name: string;
  status?: string;
  optimizationGoal?: string;
  dailyBudget?: string | null;
  lifetimeBudget?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
}

export interface FacebookAdResponse {
  id: string;
  accountId: string;
  campaignId?: string | null;
  adSetId?: string | null;
  name: string;
  status?: string;
  creativeId?: string | null;
}

export interface FacebookInsightResponse {
  accountId: string;
  entityId: string;
  level: 'campaign' | 'adset' | 'ad';
  date: Date;
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpa?: string;
  roas?: string;
  purchaseValue?: string;
  currency?: string;
}

export interface FacebookApiClient {
  fetchAdAccounts(): Promise<FacebookAdAccountResponse[]>;
  fetchCampaigns(accountId: string): Promise<FacebookCampaignResponse[]>;
  fetchAdSets(accountId: string): Promise<FacebookAdSetResponse[]>;
  fetchAds(accountId: string): Promise<FacebookAdResponse[]>;
  fetchInsights(
    accountId: string,
    level: 'campaign' | 'adset' | 'ad',
    options?: { since?: Date }
  ): Promise<FacebookInsightResponse[]>;
}

interface GraphPaging<T> {
  data: T[];
  paging?: { next?: string };
  error?: { message?: string };
}

function buildUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function fetchAllPages<T>(url: URL): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | undefined = url.toString();

  while (nextUrl) {
    const response = await fetch(nextUrl, { cache: 'no-store' });
    const json = (await response.json()) as GraphPaging<T>;

    if (!response.ok) {
      throw new Error(json.error?.message ?? 'Facebook API error');
    }

    if (Array.isArray(json.data)) {
      results.push(...json.data);
    }

    nextUrl = json.paging?.next;
  }

  return results;
}

function parseDate(value?: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export function createFacebookApiClient(
  accessToken: string
): FacebookApiClient {
  const tokenParam = { access_token: accessToken };

  return {
    async fetchAdAccounts() {
      const fields = 'id,account_id,name,currency,account_status,timezone_name';
      const url = buildUrl('/me/adaccounts', {
        ...tokenParam,
        fields,
        limit: '500'
      });

      const raw = await fetchAllPages<{
        id: string;
        account_id: string;
        name: string;
        currency?: string;
        account_status?: number;
        timezone_name?: string;
      }>(url);

      return raw.map((item) => ({
        id: item.id,
        accountId: item.account_id,
        name: item.name,
        currency: item.currency,
        status: item.account_status?.toString(),
        timezoneName: item.timezone_name
      }));
    },
    async fetchCampaigns(accountId: string) {
      const fields =
        'id,name,status,objective,buying_type,start_time,stop_time';
      const url = buildUrl(`/${accountId}/campaigns`, {
        ...tokenParam,
        fields,
        limit: '500'
      });

      const raw = await fetchAllPages<{
        id: string;
        name: string;
        status?: string;
        objective?: string;
        buying_type?: string;
        start_time?: string;
        stop_time?: string;
      }>(url);

      return raw.map((item) => ({
        id: item.id,
        accountId,
        name: item.name,
        status: item.status,
        objective: item.objective,
        buyingType: item.buying_type,
        startTime: parseDate(item.start_time) ?? null,
        stopTime: parseDate(item.stop_time) ?? null
      }));
    },
    async fetchAdSets(accountId: string) {
      const fields =
        'id,name,status,campaign_id,optimization_goal,daily_budget,lifetime_budget,start_time,end_time';
      const url = buildUrl(`/${accountId}/adsets`, {
        ...tokenParam,
        fields,
        limit: '500'
      });

      const raw = await fetchAllPages<{
        id: string;
        name: string;
        status?: string;
        campaign_id?: string;
        optimization_goal?: string;
        daily_budget?: string;
        lifetime_budget?: string;
        start_time?: string;
        end_time?: string;
      }>(url);

      return raw.map((item) => ({
        id: item.id,
        accountId,
        campaignId: item.campaign_id,
        name: item.name,
        status: item.status,
        optimizationGoal: item.optimization_goal,
        dailyBudget: item.daily_budget,
        lifetimeBudget: item.lifetime_budget,
        startTime: parseDate(item.start_time) ?? null,
        endTime: parseDate(item.end_time) ?? null
      }));
    },
    async fetchAds(accountId: string) {
      const fields = 'id,name,status,campaign_id,adset_id,creative{id}';
      const url = buildUrl(`/${accountId}/ads`, {
        ...tokenParam,
        fields,
        limit: '500'
      });

      const raw = await fetchAllPages<{
        id: string;
        name: string;
        status?: string;
        campaign_id?: string;
        adset_id?: string;
        creative?: { id?: string };
      }>(url);

      return raw.map((item) => ({
        id: item.id,
        accountId,
        campaignId: item.campaign_id,
        adSetId: item.adset_id,
        name: item.name,
        status: item.status,
        creativeId: item.creative?.id ?? null
      }));
    },
    async fetchInsights(accountId: string, level, options) {
      const fields = [
        'campaign_id',
        'adset_id',
        'ad_id',
        'date_start',
        'date_stop',
        'spend',
        'impressions',
        'clicks',
        'cpa',
        'purchase_roas',
        'purchase_conversion_value',
        'account_currency'
      ].join(',');

      const params: Record<string, string | undefined> = {
        ...tokenParam,
        level,
        fields,
        time_increment: '1',
        limit: '500'
      };

      if (options?.since) {
        const since = options.since.toISOString().slice(0, 10);
        const until = new Date().toISOString().slice(0, 10);
        params.time_range = JSON.stringify({ since, until });
      }

      const url = buildUrl(`/${accountId}/insights`, params);

      const raw = await fetchAllPages<{
        campaign_id?: string;
        adset_id?: string;
        ad_id?: string;
        date_start: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        cpa?: string;
        purchase_roas?: { value?: string }[];
        purchase_conversion_value?: string;
        account_currency?: string;
      }>(url);

      return raw
        .map((item) => {
          const entityId =
            level === 'campaign'
              ? item.campaign_id
              : level === 'adset'
                ? item.adset_id
                : item.ad_id;

          return {
            accountId,
            entityId: entityId ?? '',
            level,
            date: parseDate(item.date_start) ?? new Date(),
            spend: item.spend,
            impressions: item.impressions,
            clicks: item.clicks,
            cpa: item.cpa,
            roas: item.purchase_roas?.[0]?.value,
            purchaseValue: item.purchase_conversion_value,
            currency: item.account_currency
          };
        })
        .filter((item) => item.entityId);
    }
  };
}
