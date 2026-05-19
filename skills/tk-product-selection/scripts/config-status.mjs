#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const target = join(scriptDir, 'local-credentials.mjs');
const child = spawn(process.execPath, [target, 'status'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.setEncoding('utf8');
child.stderr.setEncoding('utf8');
child.stdout.on('data', chunk => {
  stdout += chunk;
});
child.stderr.on('data', chunk => {
  stderr += chunk;
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  if (code !== 0) {
    if (stderr.trim()) process.stderr.write(stderr);
    else if (stdout.trim()) process.stderr.write(stdout);
    process.exit(code ?? 1);
  }

  try {
    const raw = JSON.parse(stdout);
    const result = {
      ok: true,
      hasCollectionSyncConfig: Boolean(raw.hasFirebaseConfig),
      hasFastmossConfig: Boolean(raw.hasFastmossDefault),
      fastmossStatus: raw.fastmossStatus || null,
      dianxiaomiAccounts: Array.isArray(raw.dianxiaomiAccounts) ? raw.dianxiaomiAccounts : [],
      updatedAt: raw.updatedAt || null,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch {
    process.stderr.write('配置状态输出无法解析。\n');
    process.exit(1);
  }
});
