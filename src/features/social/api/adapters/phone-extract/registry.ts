import { facebookPhoneAdapter } from './facebook';
import type { PhoneExtractAdapter } from './types';

const adapters: readonly PhoneExtractAdapter[] = [facebookPhoneAdapter];
const registry = new Map<string, PhoneExtractAdapter>(adapters.map((a) => [a.platform, a]));

export function findPhoneExtractAdapter(platform: string): PhoneExtractAdapter {
  const adapter = registry.get(platform);
  if (!adapter) throw new Error(`No phone-extract adapter for platform: ${platform}`);
  return adapter;
}
