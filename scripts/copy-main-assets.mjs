import { cp, stat } from 'node:fs/promises';
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
await assertExists(path.join(root, 'logo.png'));

await cp(path.join(root, 'logo.png'), path.join(distDir, 'logo.png'), {
  force: true
});

await assertExists(path.join(distDir, 'logo.png'));
