import { spawn } from 'node:child_process';

const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  'preview',
  '--host',
  '127.0.0.1',
  '--port',
  String(port),
  '--strictPort'
], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', chunk => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', chunk => {
  serverOutput += chunk.toString();
});

function stopServer() {
  if (!server.killed) server.kill('SIGTERM');
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Vite preview did not start in time.\n${serverOutput}`);
}

async function fetchText(pathname, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`${pathname} returned ${response.status}, expected ${expectedStatus}`);
  }
  return {
    contentType: response.headers.get('content-type') || '',
    text
  };
}

async function assertText(pathname, pattern, expectedStatus = 200) {
  const { text } = await fetchText(pathname, expectedStatus);
  if (!pattern.test(text)) {
    throw new Error(`${pathname} did not match ${pattern}`);
  }
}

try {
  await waitForServer();

  await assertText('/', /TK 电商工具箱[\s\S]*data-view="analytics"[\s\S]*隐私与数据边界/);
  await assertText('/privacy.html', /隐私与数据边界[\s\S]*你自己的 Firebase Firestore[\s\S]*当前浏览器内存/);
  await assertText('/terms.html', /使用条款与免责声明[\s\S]*工具结果仅供参考[\s\S]*用户自有数据责任/);
  await assertText('/404.html', /页面不存在[\s\S]*返回工具首页/);
  await assertText('/site-page.css', /\.panel[\s\S]*\.site-page-error/);
  await assertText('/robots.txt', /Sitemap:\s*https:\/\/tk-evu\.pages\.dev\/sitemap\.xml/);
  await assertText('/sitemap.xml', /<loc>https:\/\/tk-evu\.pages\.dev\/<\/loc>[\s\S]*<lastmod>2026-05-05<\/lastmod>[\s\S]*privacy\.html[\s\S]*<lastmod>2026-05-05<\/lastmod>[\s\S]*terms\.html/);
  await assertText('/manifest.webmanifest', /"name":\s*"TK 电商工具箱"[\s\S]*"display":\s*"standalone"/);
  await assertText('/_headers', /\/index\.html[\s\S]*Cache-Control:\s*public, max-age=300, must-revalidate[\s\S]*\/logo\.png[\s\S]*Cache-Control:\s*public, max-age=86400, must-revalidate[\s\S]*\/robots\.txt[\s\S]*Content-Type:\s*text\/plain; charset=utf-8[\s\S]*\/sitemap\.xml[\s\S]*Content-Type:\s*application\/xml; charset=utf-8/);
  await assertText('/js/app.js', /function switchView\(key\)/);
  await fetchText('/js/orders/provider-supabase.js', 404);

  const { contentType } = await fetchText('/manifest.webmanifest');
  if (!/application\/manifest\+json|application\/json/.test(contentType)) {
    throw new Error(`/manifest.webmanifest returned unexpected content-type: ${contentType}`);
  }

  console.log('preview smoke ok');
} finally {
  stopServer();
}
