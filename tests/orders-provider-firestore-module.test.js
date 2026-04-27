const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'provider-firestore.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

assert.match(
  source,
  /const OrderTrackerProviderFirestore = \(function \(\) \{/,
  '需要新的 Firestore provider 模块'
);

assert.match(
  source,
  /function create\(/,
  'Firestore provider 需要暴露 create 工厂'
);

assert.match(
  source,
  /firebase\.initializeApp/,
  'Firestore provider 需要创建 Firebase app'
);

assert.match(
  source,
  /enablePersistence/,
  'Firestore provider 需要启用 Firestore 自带离线缓存'
);

assert.match(
  source,
  /parseConfigInput/,
  'Firestore provider 需要解析 firebaseConfig'
);

assert.match(
  source,
  /pullSnapshot/,
  'Firestore provider 需要暴露 pullSnapshot'
);

assert.match(
  source,
  /pushChanges/,
  'Firestore provider 需要暴露 pushChanges'
);

assert.match(
  source,
  /assignOrderSeqs/,
  'Firestore provider 需要为缺失 seq 的订单补录入顺序号'
);

assert.match(
  source,
  /salePrice[\s\S]*estimatedShippingFee[\s\S]*estimatedProfit/,
  'Firestore provider 需要按字段映射售价、预估运费、预估利润'
);

assert.match(
  source,
  /'是否退款': data\?\.isRefunded \? '1' : ''[\s\S]*isRefunded: toBoolean\(order\?\.\['是否退款'\]\)/,
  'Firestore provider 需要映射订单退款状态字段'
);

assert.match(
  source,
  /'商品TK ID': data\?\.productTkId \|\| ''[\s\S]*productTkId: toNullableText\(onlyItem\?\.productTkId \|\| order\?\.\['商品TK ID'\]\)/,
  'Firestore provider 需要映射订单关联商品 TK ID'
);

assert.match(
  source,
  /'商品SKU ID': data\?\.productSkuId \|\| ''[\s\S]*'商品SKU名称': data\?\.productSkuName \|\| ''[\s\S]*productSkuId: toNullableText\(onlyItem\?\.productSkuId \|\| order\?\.\['商品SKU ID'\]\)[\s\S]*productSkuName: toNullableText\(onlyItem\?\.productSkuName \|\| order\?\.\['商品SKU名称'\]\)/,
  'Firestore provider 需要映射订单关联 SKU 字段'
);

assert.match(
  source,
  /function normalizeOrderItems\(/,
  'Firestore provider 需要支持订单明细 items 结构'
);

assert.match(
  source,
  /deriveOrderItemTotals[\s\S]*buildOrderItemsSummary/,
  'Firestore provider 需要从 items 推导订单级汇总字段'
);

assert.match(
  source,
  /items: items\.length \? items\.map\(item => \(\{/,
  'Firestore provider 写回 Firestore 时需要保存订单明细 items'
);

assert.match(
  source,
  /query\.get\(\{ source: 'server' \}\)[\s\S]*return query\.get\(\)/,
  'Firestore provider 拉取数据时需要优先读取服务器，再回退到本地缓存'
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
                  get: async () => ({ docs: [] }),
                  doc() {
                    return {
                      get: async () => ({ exists: false, data: () => ({}) })
                    };
                  }
                };
              },
              batch() {
                return {
                  set() {},
                  commit: async () => {}
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
vm.runInContext(`${source}\nthis.OrderTrackerProviderFirestore = OrderTrackerProviderFirestore;`, sandbox);

const provider = sandbox.OrderTrackerProviderFirestore.create({
  state: {
    firestoreConfigText: '',
    firestoreProjectId: '',
    user: ''
  },
  helpers: {
    nowIso: () => '2026-04-23T10:00:00.000Z',
    normalizeOrderList: list => Array.isArray(list) ? list : [],
    uniqueAccounts: list => Array.isArray(list) ? [...new Set(list.filter(Boolean))] : []
  }
});

assert.equal(provider.key, 'firestore', 'Firestore provider 需要暴露 firestore key');
assert.equal(typeof provider.init, 'function', 'Firestore provider 需要暴露 init');
assert.equal(typeof provider.pullSnapshot, 'function', 'Firestore provider 需要暴露 pullSnapshot');
assert.equal(typeof provider.pushChanges, 'function', 'Firestore provider 需要暴露 pushChanges');
assert.equal(typeof provider.parseConfigInput, 'function', 'Firestore provider 需要暴露 firebaseConfig 解析工具');

assert.match(
  htmlSource,
  /<script src="js\/orders\/provider-firestore\.js" defer><\/script>/,
  'index.html 需要在订单模块中加载 Firestore provider'
);

const configText = `const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`;

provider.init({ configText })
  .then(() => provider.init({ configText }))
  .then(() => {
    console.log('orders firestore provider contract ok');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
