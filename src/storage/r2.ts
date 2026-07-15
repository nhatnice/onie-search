import { createHash } from 'node:crypto';

import { PutObjectCommand } from '@aws-sdk/client-s3';

import { env } from '@/lib/env';

import { buildPublicUrl, type ObjectStorage, type UploadResult } from './adapter';
import { getR2Client } from './client';

export class R2ObjectStorage implements ObjectStorage {
  private readonly client = getR2Client();
  private readonly bucket = env.r2Bucket;

  async upload(key: string, body: Buffer, mimeType: string): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: mimeType,
      }),
    );
    const hash = createHash('sha256').update(body).digest('hex');
    return {
      key,
      path: key,
      size: body.length,
      hash,
      url: buildPublicUrl(key, env.r2PublicUrl),
    };
  }

  async exists(_hash: string): Promise<string | undefined> {
    return undefined;
  }
}
