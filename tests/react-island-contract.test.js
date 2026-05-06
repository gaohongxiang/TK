const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const viteConfig = fs.readFileSync(path.join(root, 'vite.config.mjs'), 'utf8');
const tsconfig = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8'));
const tailwindConfig = fs.readFileSync(path.join(root, 'tailwind.config.ts'), 'utf8');
const componentsJson = JSON.parse(fs.readFileSync(path.join(root, 'components.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const reactMain = fs.readFileSync(path.join(root, 'src', 'react', 'main.tsx'), 'utf8');
const reactIsland = fs.readFileSync(path.join(root, 'src', 'react', 'app', 'ReactIsland.tsx'), 'utf8');
const utilsSource = fs.readFileSync(path.join(root, 'src', 'react', 'lib', 'utils.ts'), 'utf8');

[
  'react',
  'react-dom',
  '@radix-ui/react-slot',
  '@tanstack/react-table',
  'echarts',
  'echarts-for-react',
  'lucide-react',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'tailwindcss-animate'
].forEach(name => {
  assert.ok(packageJson.dependencies[name], `React 迁移依赖需要包含 ${name}`);
});

[
  'typescript',
  '@types/react',
  '@types/react-dom',
  '@vitejs/plugin-react',
  'tailwindcss',
  'postcss',
  'autoprefixer'
].forEach(name => {
  assert.ok(packageJson.devDependencies[name], `React 迁移开发依赖需要包含 ${name}`);
});

assert.match(
  viteConfig,
  /import react from '@vitejs\/plugin-react'[\s\S]*plugins:\s*\[react\(\)\]/,
  'Vite 配置需要接入 React 插件'
);

assert.strictEqual(tsconfig.compilerOptions.jsx, 'react-jsx', 'TypeScript 需要启用 React JSX transform');
assert.strictEqual(tsconfig.compilerOptions.strict, false, 'React 迁移初期不要一步开启 strict');
assert.deepStrictEqual(tsconfig.compilerOptions.paths['@/*'], ['src/react/*'], 'React 代码需要配置 @ alias');

assert.match(
  tailwindConfig,
  /content:\s*\['\.\/index\.html', '\.\/src\/react\/\*\*\/\*\.\{ts,tsx\}'\]/,
  'Tailwind 只应先扫描 React 迁移目录和 index.html'
);

assert.strictEqual(componentsJson.rsc, false, 'shadcn 配置需要关闭 RSC');
assert.strictEqual(componentsJson.tsx, true, 'shadcn 配置需要使用 TSX');
assert.strictEqual(componentsJson.aliases.components, '@/components', 'shadcn components alias 需要指向 React 目录 alias');

assert.match(
  indexSource,
  /<div id="react-island-root" hidden><\/div>[\s\S]*<script type="module" src="\/src\/react\/main\.tsx"><\/script>/,
  '首页需要提供独立 React island mount 容器和入口'
);

assert.match(
  reactMain,
  /getElementById\('react-island-root'\)[\s\S]*dataset\.reactMounted[\s\S]*createRoot\(root\)\.render/,
  'React 入口需要只挂载独立 island，且避免重复挂载'
);

assert.match(
  reactIsland,
  /data-react-island-ready="true"[\s\S]*hidden/,
  'React island 初期需要隐藏健康检查节点，避免影响现有页面'
);

assert.match(
  utilsSource,
  /twMerge\(clsx\(inputs\)\)/,
  'React 工具层需要提供 shadcn 常用 cn helper'
);

console.log('react island contract ok');
