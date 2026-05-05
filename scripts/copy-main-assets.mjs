import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

async function assertExists(target) {
  try {
    await stat(target);
  } catch (error) {
    throw new Error(`Build asset is missing: ${path.relative(root, target)}`);
  }
}

await assertExists(path.join(distDir, 'index.html'));
await mkdir(path.join(distDir, 'js'), { recursive: true });
await cp(path.join(root, 'js'), path.join(distDir, 'js'), {
  recursive: true,
  force: true
});
await rm(path.join(distDir, 'js', 'orders', 'provider-supabase.js'), {
  force: true
});
