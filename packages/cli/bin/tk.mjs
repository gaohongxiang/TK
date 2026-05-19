#!/usr/bin/env node

import { main } from '../src/main.mjs';

main(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error || '命令执行失败');
  console.error(message);
  process.exitCode = 1;
});
