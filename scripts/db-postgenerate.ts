import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import * as schema from '@/db/schema';

const schemas = new Set<string>();
for (const value of Object.values(schema)) {
  const tbl = value as unknown as Record<symbol, unknown>;
  if (tbl[Symbol.for('drizzle:IsDrizzleTable')]) {
    const s = tbl[Symbol.for('drizzle:Schema')] as string | undefined;
    if (s) schemas.add(s);
  }
}

if (schemas.size === 0) process.exit(0);

const files = readdirSync(resolve(process.cwd(), 'drizzle')).filter((f) => f.endsWith('.sql'));
if (files.length === 0) process.exit(0);
const latest = files.sort().reverse()[0]!;

const path = resolve(process.cwd(), 'drizzle', latest);
const content = readFileSync(path, 'utf-8');

if (content.includes('CREATE SCHEMA')) process.exit(0);

const prefix = [...schemas]
  .map((s) => `CREATE SCHEMA IF NOT EXISTS "${s}";\n--> statement-breakpoint\n`)
  .join('');

writeFileSync(path, prefix + content);
console.log(`Patched ${latest} — added CREATE SCHEMA`);
