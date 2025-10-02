'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@clerk/nextjs/server';
import { SyncJobStatus } from '@prisma/client';

import { decryptSecret } from '@/lib/crypto';
import {
  createSyncJob,
  getFacebookTokenByUserId,
  updateSyncJob
} from '@/lib/prisma/repositories/facebook';

import { createFacebookApiClient } from '@/features/facebook-sync/services/facebook-api';
import { refreshFacebookData } from '@/features/facebook-sync/workers/refresh.worker';

const inputSchema = z.object({
  since: z.date().optional()
});

export async function triggerManualFacebookRefresh(input: {
  since?: Date | string | null;
}) {
  const { since } = inputSchema.parse({
    since: typeof input.since === 'string' ? new Date(input.since) : input.since
  });

  const { userId } = auth();
  if (!userId) {
    throw new Error('Người dùng chưa đăng nhập');
  }

  const tokenRecord = await getFacebookTokenByUserId(userId);
  if (!tokenRecord) {
    throw new Error('Không tìm thấy token Facebook');
  }

  if (tokenRecord.requiresReauth) {
    throw new Error('Token đã hết hạn, vui lòng kết nối lại Facebook');
  }

  const accessToken = decryptSecret(tokenRecord.accessTokenEncrypted);
  const job = await createSyncJob({
    userId,
    tokenId: tokenRecord.id,
    status: SyncJobStatus.RUNNING
  });

  try {
    const api = createFacebookApiClient(accessToken);
    const result = await refreshFacebookData({
      userId,
      tokenId: tokenRecord.id,
      api,
      since: since ?? undefined
    });

    await updateSyncJob(job.id, {
      status: SyncJobStatus.SUCCESS,
      finishedAt: new Date()
    });

    revalidatePath('/dashboard/ads-manager');

    return {
      ok: true,
      synced: result
    };
  } catch (error) {
    await updateSyncJob(job.id, {
      status: SyncJobStatus.FAILED,
      finishedAt: new Date(),
      errorPayload: {
        message:
          error instanceof Error ? error.message : 'Không đồng bộ được dữ liệu'
      }
    });

    throw error;
  }
}
