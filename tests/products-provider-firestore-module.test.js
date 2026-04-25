const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'products', 'provider-firestore.js'), 'utf8');

assert.match(
  source,
  /const ProductLibraryProviderFirestore = \(function \(\) \{/,
  '商品库需要独立的 Firestore provider 模块'
);

assert.match(
  source,
  /function parseConfigInput\(/,
  '商品库 Firestore provider 需要解析 firebaseConfig'
);

assert.match(
  source,
  /collection\('products'\)/,
  '商品库 Firestore provider 需要读写 products 集合'
);

assert.match(
  source,
  /collection\('order_accounts'\)/,
  '商品库 Firestore provider 需要复用 order_accounts 集合作为共享账号来源'
);

assert.match(
  source,
  /function normalizeProductDefaults\(|defaults:\s*buildProductDefaultsDoc|defaults:\s*normalizeProductDefaults/,
  '商品库 Firestore provider 需要把商品默认物流参数收进 defaults 结构'
);

assert.match(
  source,
  /function normalizePulledSku\(/,
  '商品库 Firestore provider 需要支持 SKU 子结构'
);

assert.match(
  source,
  /skus: Array\.isArray\(data\?\.skus\)[\s\S]*buildSkuDoc/,
  '商品库 Firestore provider 需要读写 skus 数组'
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
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.ProductLibraryProviderFirestore = ProductLibraryProviderFirestore;`, sandbox);

const provider = sandbox.ProductLibraryProviderFirestore.create({
  state: {
    firestoreConfigText: '',
    firestoreProjectId: '',
    user: ''
  },
  helpers: {
    nowIso: () => '2026-04-24T10:00:00.000Z'
  }
});

assert.equal(provider.key, 'firestore', '商品库 Firestore provider 需要暴露 firestore key');
assert.equal(typeof provider.parseConfigInput, 'function', '商品库 Firestore provider 需要暴露 parseConfigInput');
assert.equal(typeof provider.init, 'function', '商品库 Firestore provider 需要暴露 init');
assert.equal(typeof provider.pullProducts, 'function', '商品库 Firestore provider 需要暴露 pullProducts');
assert.equal(typeof provider.upsertProduct, 'function', '商品库 Firestore provider 需要暴露 upsertProduct');
assert.equal(typeof provider.deleteProduct, 'function', '商品库 Firestore provider 需要暴露 deleteProduct');

const parsed = provider.parseConfigInput(`const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`);

assert.equal(parsed.projectId, 'demo', '商品库 Firestore provider 应能解析 projectId');

const configText = `const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`;

provider.init({ configText })
  .then(() => provider.init({ configText }))
  .then(() => {
    console.log('products firestore provider contract ok');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
