import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { DbOrTx } from '@/db/types';
import { pageContents } from '@/features/pages/api/schema';
import { env } from '@/lib/env';

import { buildPublicUrl, type ObjectStorage, type UploadResult } from './adapter';

export async function uploadWithDedup(
  storage: ObjectStorage,
  db: DbOrTx,
  key: string,
  body: Buffer,
  mimeType: string,
): Promise<UploadResult> {
  const hash = createHash('sha256').update(body).digest('hex');
  const existing = await db
    .select({ blobPath: pageContents.blobPath })
    .from(pageContents)
    .where(eq(pageContents.blobHash, hash))
    .limit(1);
  if (existing[0]) {
    return {
      key: existing[0].blobPath,
      path: existing[0].blobPath,
      size: body.length,
      hash,
      url: buildPublicUrl(existing[0].blobPath, env.r2PublicUrl),
    };
  }
  return storage.upload(key, body, mimeType);
}
