import type { DbOrTx } from '@/db';

import { findPhoneExtractAdapter } from '../adapters/phone-extract/registry';
import { getAccountsNeedingPhone, insertAccountContact } from '../queries';

export async function extractPhone(
  db: DbOrTx,
  accountId: string,
  platformId: string,
  platformUserId: string,
): Promise<void> {
  const adapter = findPhoneExtractAdapter(platformId);
  const phone = await adapter.getPhone(platformUserId);
  await insertAccountContact(db, { accountId, type: 'phone', value: phone });
}

export interface PhoneExtractJob {
  accountId: string;
  platformUserId: string;
  platformId: string;
}

export async function buildPhoneExtractJobs(db: DbOrTx, limit: number): Promise<PhoneExtractJob[]> {
  const accounts = await getAccountsNeedingPhone(db, 'facebook', limit);
  return accounts.map((a) => ({
    accountId: a.id,
    platformUserId: a.platformUserId,
    platformId: a.platformId,
  }));
}
