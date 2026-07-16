import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(process.cwd(), '.env');
const raw = readFileSync(envFile, 'utf-8');

const env: Record<string, string> = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
}

if (env.DATABASE_URL) {
  env.DATABASE_URL = env.DATABASE_URL.replace('localhost', 'host.docker.internal');
}

const envArgs = Object.entries(env)
  .map(([k, v]) => ['-e', `${k}=${v}`])
  .flat();

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with ${code}`));
    });
  });
}

async function main() {
  const image = 'portal:local';
  console.log('=== Building ===');
  await run('docker', ['build', '-t', image, '.']);
  console.log('\n=== Running ===');
  await run('docker', ['run', '--rm', '-p', '3000:3000', ...envArgs, image]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
