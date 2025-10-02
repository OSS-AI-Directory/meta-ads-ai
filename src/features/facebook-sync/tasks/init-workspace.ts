'use server';

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

export async function initializeAdWorkspace() {
  const { userId } = auth();
  if (!userId) {
    throw new Error('Người dùng chưa đăng nhập');
  }

  const token = await getFacebookTokenByUserId(userId);
  if (!token) {
    throw new Error('Chưa có token Facebook để đồng bộ');
  }

  if (token.requiresReauth) {
    throw new Error('Token Facebook yêu cầu kết nối lại');
  }

  const accessToken = decryptSecret(token.accessTokenEncrypted);
  const api = createFacebookApiClient(accessToken);
  const job = await createSyncJob({
    userId,
    tokenId: token.id,
    status: SyncJobStatus.RUNNING
  });

  try {
    const result = await refreshFacebookData({
      userId,
      tokenId: token.id,
      api,
      markInitialSync: true
    });

    await updateSyncJob(job.id, {
      status: SyncJobStatus.SUCCESS,
      finishedAt: new Date()
    });

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
          error instanceof Error
            ? error.message
            : 'Không thể khởi tạo workspace'
      }
    });
    throw error;
  }
}
