'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';

import { triggerManualFacebookRefresh } from '@/features/facebook-sync/actions/manual-refresh';

interface AccountOption {
  id: string;
  name: string;
  status?: string | null;
  currency?: string | null;
}

interface MetricRow {
  id: string;
  name: string;
  status?: string | null;
  objective?: string | null;
  optimizationGoal?: string | null;
  dailyBudget?: number | null;
  lifetimeBudget?: number | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  cpa?: number | null;
  roas?: number | null;
  purchaseValue?: number | null;
  currency?: string | null;
}

export type AdsManagerTab = 'campaigns' | 'adsets' | 'ads';

export interface AdsManagerDashboardProps {
  accounts: AccountOption[];
  selectedAccountId?: string | null;
  activeTab: AdsManagerTab;
  campaigns: MetricRow[];
  adSets: MetricRow[];
  ads: MetricRow[];
  requiresReauth?: boolean;
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatCurrency(value?: number | null, currency?: string | null) {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency ?? 'USD',
    maximumFractionDigits: 2
  }).format(value);
}

const campaignColumns: ColumnDef<MetricRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chiến dịch' />
    )
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Trạng thái' />
    )
  },
  {
    accessorKey: 'objective',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Mục tiêu' />
    )
  },
  {
    accessorKey: 'spend',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chi tiêu' />
    ),
    cell: ({ row }) => formatCurrency(row.original.spend, row.original.currency)
  },
  {
    accessorKey: 'impressions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Hiển thị' />
    ),
    cell: ({ row }) => formatNumber(row.original.impressions)
  },
  {
    accessorKey: 'clicks',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lượt nhấp' />
    ),
    cell: ({ row }) => formatNumber(row.original.clicks)
  },
  {
    accessorKey: 'cpa',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='CPA' />
    ),
    cell: ({ row }) => formatCurrency(row.original.cpa, row.original.currency)
  },
  {
    accessorKey: 'roas',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='ROAS' />
    ),
    cell: ({ row }) =>
      row.original.roas === null || row.original.roas === undefined
        ? '-'
        : row.original.roas.toFixed(2)
  },
  {
    accessorKey: 'purchaseValue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Doanh thu' />
    ),
    cell: ({ row }) =>
      formatCurrency(row.original.purchaseValue, row.original.currency)
  }
];

const adSetColumns: ColumnDef<MetricRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Nhóm quảng cáo' />
    )
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Trạng thái' />
    )
  },
  {
    accessorKey: 'optimizationGoal',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Tối ưu hóa' />
    )
  },
  {
    accessorKey: 'dailyBudget',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Ngân sách ngày' />
    ),
    cell: ({ row }) =>
      formatCurrency(row.original.dailyBudget, row.original.currency)
  },
  {
    accessorKey: 'lifetimeBudget',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Ngân sách tổng' />
    ),
    cell: ({ row }) =>
      formatCurrency(row.original.lifetimeBudget, row.original.currency)
  },
  {
    accessorKey: 'spend',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chi tiêu' />
    ),
    cell: ({ row }) => formatCurrency(row.original.spend, row.original.currency)
  },
  {
    accessorKey: 'impressions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Hiển thị' />
    ),
    cell: ({ row }) => formatNumber(row.original.impressions)
  },
  {
    accessorKey: 'clicks',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lượt nhấp' />
    ),
    cell: ({ row }) => formatNumber(row.original.clicks)
  },
  {
    accessorKey: 'cpa',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='CPA' />
    ),
    cell: ({ row }) => formatCurrency(row.original.cpa, row.original.currency)
  }
];

const adColumns: ColumnDef<MetricRow>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Quảng cáo' />
    )
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Trạng thái' />
    )
  },
  {
    accessorKey: 'spend',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Chi tiêu' />
    ),
    cell: ({ row }) => formatCurrency(row.original.spend, row.original.currency)
  },
  {
    accessorKey: 'impressions',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Hiển thị' />
    ),
    cell: ({ row }) => formatNumber(row.original.impressions)
  },
  {
    accessorKey: 'clicks',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Lượt nhấp' />
    ),
    cell: ({ row }) => formatNumber(row.original.clicks)
  },
  {
    accessorKey: 'cpa',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='CPA' />
    ),
    cell: ({ row }) => formatCurrency(row.original.cpa, row.original.currency)
  },
  {
    accessorKey: 'purchaseValue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Giá trị mua' />
    ),
    cell: ({ row }) =>
      formatCurrency(row.original.purchaseValue, row.original.currency)
  }
];

export function AdsManagerDashboard(props: AdsManagerDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isRefreshing, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const updateQuery = React.useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false
      });
    },
    [pathname, router, searchParams]
  );

  const [campaignPagination, setCampaignPagination] =
    React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: 25
    });
  const [campaignSorting, setCampaignSorting] = React.useState<SortingState>(
    []
  );
  const campaignTable = useReactTable({
    data: props.campaigns,
    columns: campaignColumns,
    state: {
      pagination: campaignPagination,
      sorting: campaignSorting
    },
    onPaginationChange: setCampaignPagination,
    onSortingChange: setCampaignSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false
  });

  const [adSetPagination, setAdSetPagination] = React.useState<PaginationState>(
    {
      pageIndex: 0,
      pageSize: 25
    }
  );
  const [adSetSorting, setAdSetSorting] = React.useState<SortingState>([]);
  const adSetTable = useReactTable({
    data: props.adSets,
    columns: adSetColumns,
    state: {
      pagination: adSetPagination,
      sorting: adSetSorting
    },
    onPaginationChange: setAdSetPagination,
    onSortingChange: setAdSetSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false
  });

  const [adPagination, setAdPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25
  });
  const [adSorting, setAdSorting] = React.useState<SortingState>([]);
  const adTable = useReactTable({
    data: props.ads,
    columns: adColumns,
    state: {
      pagination: adPagination,
      sorting: adSorting
    },
    onPaginationChange: setAdPagination,
    onSortingChange: setAdSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false
  });

  const handleAccountChange = React.useCallback(
    (value: string) => {
      updateQuery({ accountId: value });
    },
    [updateQuery]
  );

  const handleTabChange = React.useCallback(
    (value: string) => {
      updateQuery({ tab: value });
    },
    [updateQuery]
  );

  const handleManualRefresh = React.useCallback(() => {
    setMessage(null);
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await triggerManualFacebookRefresh({ since: undefined });
        setMessage('Đã làm mới dữ liệu thành công');
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Không thể làm mới dữ liệu, vui lòng thử lại'
        );
      }
    });
  }, []);

  const activeAccountId =
    props.selectedAccountId ?? props.accounts[0]?.id ?? '';

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <CardTitle>Trình quản lý quảng cáo</CardTitle>
          <CardDescription>
            Theo dõi chiến dịch, nhóm quảng cáo và quảng cáo của bạn giống Ads
            Manager.
          </CardDescription>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Select
            value={props.accounts.length ? activeAccountId : undefined}
            onValueChange={handleAccountChange}
            disabled={!props.accounts.length}
          >
            <SelectTrigger className='w-[240px]'>
              <SelectValue placeholder='Chọn tài khoản quảng cáo' />
            </SelectTrigger>
            <SelectContent>
              {props.accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleManualRefresh} disabled={isRefreshing}>
            {isRefreshing ? 'Đang cập nhật...' : 'Làm mới dữ liệu'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {props.requiresReauth && (
          <Alert variant='destructive'>
            <AlertTitle>Token Facebook đã hết hạn</AlertTitle>
            <AlertDescription>
              Vui lòng kết nối lại Facebook để tiếp tục đồng bộ dữ liệu quảng
              cáo.
            </AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert>
            <AlertTitle>Thành công</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert variant='destructive'>
            <AlertTitle>Lỗi</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        <Tabs value={props.activeTab} onValueChange={handleTabChange}>
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='campaigns'>Chiến dịch</TabsTrigger>
            <TabsTrigger value='adsets'>Nhóm quảng cáo</TabsTrigger>
            <TabsTrigger value='ads'>Quảng cáo</TabsTrigger>
          </TabsList>
          <TabsContent value='campaigns'>
            <DataTable table={campaignTable}>
              <DataTableToolbar table={campaignTable} />
            </DataTable>
          </TabsContent>
          <TabsContent value='adsets'>
            <DataTable table={adSetTable}>
              <DataTableToolbar table={adSetTable} />
            </DataTable>
          </TabsContent>
          <TabsContent value='ads'>
            <DataTable table={adTable}>
              <DataTableToolbar table={adTable} />
            </DataTable>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
