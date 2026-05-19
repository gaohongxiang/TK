import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const srcSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'products', 'provider-firestore.ts'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  srcSource,
  /function parseConfigInput\(/,
  '商品库 Firestore provider ESM 需要解析 firebaseConfig'
);

assert.match(
  srcSource,
  /export\s+\{[\s\S]*ProductLibraryProviderFirestore[\s\S]*ProductLibraryProviderFirestoreUtils[\s\S]*create[\s\S]*parseConfigInput[\s\S]*normalizePulledProduct[\s\S]*buildProductDoc[\s\S]*\}/,
  '路线二 M4 需要提供商品 Firestore provider ESM 导出和 create 工厂'
);

assert.doesNotMatch(
  srcSource,
  /window\.ProductLibraryProviderFirestore|TKDataSourceRegistry|registerProvider\(/,
  '商品 Firestore provider 应保持纯 ESM 导出，不应再挂旧全局或自动注册'
);

assert.match(
  srcSource,
  /collection\('products'\)/,
  '商品库 Firestore provider ESM 需要读写 products 集合'
);

assert.match(
  srcSource,
  /collection\('order_accounts'\)/,
  '商品库 Firestore provider ESM 需要复用 order_accounts 集合作为共享账号来源'
);

assert.match(
  srcSource,
  /function normalizeProductDefaults\(|defaults:\s*buildProductDefaultsDoc|defaults:\s*normalizeProductDefaults/,
  '商品库 Firestore provider ESM 需要把商品默认物流参数收进 defaults 结构'
);

assert.match(
  srcSource,
  /function normalizePulledSku\(/,
  '商品库 Firestore provider ESM 需要支持 SKU 子结构'
);

assert.match(
  srcSource,
  /skus: Array\.isArray\(data\?\.skus\)[\s\S]*buildSkuDoc/,
  '商品库 Firestore provider ESM 需要读写 skus 数组'
);

assert.match(
  srcSource,
  /waitForCommit\s*=\s*true/,
  '商品库 Firestore provider ESM 写入应支持保存时不等待云端提交'
);

assert.match(
  srcSource,
  /commitPromise/,
  '商品库 Firestore provider ESM 保存时应返回 Firestore 本地队列写入 Promise'
);

const sandbox = {
  window: {
    firebase: {
      apps: [],
      initializeApp(config, name) {
        const app = {
          name,
          options: config,
          firestore() {
            return {
              settings() {},
              enablePersistence: async () => {},
              collection() {
                return {
                  orderBy() { return this; },
                  get: async () => ({ docs: [] }),
                  doc() {
                    return {
                      set: async () => {},
                      delete: async () => {}
                    };
                  }
                };
              }
            };
          }
        };
        this.apps.push(app);
        return app;
      }
    }
  }
};

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/products\/provider-firestore\.js" defer><\/script>/,
  'index.html 不应再加载旧商品 Firestore provider 普通脚本'
);

const configText = `const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`;

(async () => {
  const module = await import(`file://${path.join(__dirname, '..', 'src', 'products', 'provider-firestore.ts')}`);
  const parsed = module.parseConfigInput(`const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`);
  assert.equal(parsed.projectId, 'demo', '商品 provider ESM 应能解析 projectId');
  const esmParsed = module.parseConfigInput(configText);
  assert.deepStrictEqual(esmParsed, { ...parsed }, '商品 provider ESM 配置解析需要保持稳定');

  const esmProviderState = {
      firestoreConfigText: '',
      firestoreProjectId: '',
      user: ''
    };
  const esmProvider = module.ProductLibraryProviderFirestore.create({
      state: esmProviderState,
      helpers: {
        nowIso: () => '2026-04-24T10:00:00.000Z'
      },
      window: sandbox.window
    });

  assert.equal(esmProvider.key, 'firestore', '商品 provider ESM 需要暴露 firestore key');
  assert.equal(typeof esmProvider.init, 'function', '商品 provider ESM 需要暴露 init');
  assert.equal(typeof esmProvider.pullProducts, 'function', '商品 provider ESM 需要暴露 pullProducts');
  assert.equal(typeof esmProvider.upsertProduct, 'function', '商品 provider ESM 需要暴露 upsertProduct');
  assert.equal(typeof esmProvider.deleteProduct, 'function', '商品 provider ESM 需要暴露 deleteProduct');
  await esmProvider.init({ configText });
  assert.equal(esmProviderState.firestoreProjectId, 'demo', '商品 provider ESM init 需要写回项目 ID');

  assert.equal(
      module.ProductLibraryProviderFirestoreUtils.getDisplayName({ configText, user: '运营A' }),
      '运营A · Firestore',
      '商品 provider ESM 需要保留展示名称逻辑'
    );

  const productDoc = module.buildProductDoc({
      tkId: 'TK-001',
      accountName: '账号A',
      name: '雨衣',
      note: '售后风险低',
      imageUrl: '',
      link1688: 'https://detail.1688.com/item.htm?id=1',
      defaults: {
        cargoType: 'special',
        weightG: '320',
        lengthCm: '20.05',
        widthCm: '10',
        heightCm: '8',
        estimatedShippingFee: '17.026',
        chargeWeightKg: '0.42',
        shippingNote: ''
      },
      skus: [
        { skuId: 'S-1', skuName: '蓝 / M', useProductDefaults: true },
        { skuId: '', skuName: '空 SKU' }
      ],
      createdAt: '',
      updatedAt: ''
    }, {
      nowIso: () => '2026-04-24T10:00:00.000Z'
    });
  assert.equal(productDoc.tkId, 'TK-001', '商品 provider ESM 需要构造商品 doc TK ID');
  assert.equal(productDoc.note, '售后风险低', '商品 provider ESM 写入 Firestore 时需要保存商品备注');
  assert.equal(productDoc.defaults.cargoType, 'special', '商品 provider ESM 需要构造 defaults');
  assert.equal(productDoc.defaults.lengthCm, 20.05, '商品 provider ESM 需要按两位小数保存尺寸');
  assert.equal(productDoc.defaults.estimatedShippingFee, 17.03, '商品 provider ESM 需要按两位小数保存运费');
  assert.equal(productDoc.skus.length, 1, '商品 provider ESM 需要过滤空 SKU ID');
  assert.equal(productDoc.skus[0].useProductDefaults, true, '商品 provider ESM 需要保留 SKU 默认值标记');

  const normalized = module.normalizePulledProduct(productDoc);
  assert.equal(normalized.note, '售后风险低', '商品 provider ESM 拉取 Firestore 时需要恢复商品备注');
  assert.equal(normalized.defaults.estimatedShippingFee, '17.03', '商品 provider ESM 需要把 Firestore 数值归一化为表单字符串');
  assert.equal(normalized.skus[0].skuId, 'S-1', '商品 provider ESM 需要归一化 SKU 子结构');

  console.log('products firestore provider contract ok');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
