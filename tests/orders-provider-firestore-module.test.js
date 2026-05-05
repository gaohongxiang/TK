const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');
const { pathToFileURL } = require('url');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'orders', 'provider-firestore.js'), 'utf8');
const esmPath = path.join(__dirname, '..', 'src', 'orders', 'provider-firestore.mjs');
const esmSource = fs.readFileSync(esmPath, 'utf8');
const indexSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'orders', 'index.mjs'), 'utf8');
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
  esmSource,
  /const OrderTrackerProviderFirestore = \{/,
  'ESM Firestore provider 需要保留 OrderTrackerProviderFirestore 命名导出'
);

assert.match(
  esmSource,
  /function parseConfigInput\(/,
  'ESM Firestore provider 需要暴露 firebaseConfig 解析工具'
);

assert.match(
  esmSource,
  /function buildOrderDoc\(/,
  'ESM Firestore provider 需要暴露订单写入 doc 构造纯函数'
);

assert.match(
  esmSource,
  /export \{[\s\S]*OrderTrackerProviderFirestore[\s\S]*buildOrderDoc[\s\S]*normalizePulledOrder[\s\S]*parseConfigInput[\s\S]*\}/,
  'ESM Firestore provider 需要导出命名空间和关键纯函数'
);

assert.match(
  esmSource,
  /window\.OrderTrackerProviderFirestore = OrderTrackerProviderFirestore/,
  'ESM Firestore provider 需要挂回旧全局命名空间'
);

assert.match(
  esmSource,
  /TKDataSourceRegistry\.registerProvider\('orders'[\s\S]*module:\s*OrderTrackerProviderFirestore[\s\S]*localFirst:\s*true/,
  'ESM Firestore provider 需要登记为订单 Firestore 数据源'
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
  /function rawOrderNeedsCanonicalCleanup\(/,
  'Firestore provider 需要识别需要清洗的旧订单字段'
);

assert.match(
  source,
  /__needsOrderCleanup:\s*rawOrderNeedsCanonicalCleanup\(data\)/,
  'Firestore provider 拉取订单时需要标记是否仍需结构清洗'
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
  /items: items\.length \? items\.map\(item => \{/,
  'Firestore provider 写回 Firestore 时需要保存订单明细 items'
);

assert.match(
  source,
  /productName:\s*productSummary[\s\S]*items: items\.length \? items\.map\(item => \{[\s\S]*if \(courierCompany\) row\.courierCompany = courierCompany[\s\S]*if \(trackingNo\) row\.trackingNo = trackingNo[\s\S]*mutations\.push\(batch => batch\.set\(orderRef\(currentDb, row\.id\), row\)\)/,
  'Firestore provider 写回 Firestore 时需要只保留新结构字段，并用整单覆盖清掉旧兼容字段'
);

assert.match(
  source,
  /stripDuplicatedSkuSuffix\(item\.productName, item\.productSkuName\)/,
  'Firestore provider 写回 Firestore 时需要清洗明细商品名称'
);

assert.match(
  source,
  /if \(unitPurchasePrice !== null\) row\.unitPurchasePrice = unitPurchasePrice[\s\S]*if \(unitSalePrice !== null\) row\.unitSalePrice = unitSalePrice/,
  'Firestore provider 不应再把空的明细单价字段写成 null'
);

assert.match(
  source,
  /query\.get\(\{ source: 'server' \}\)[\s\S]*return query\.get\(\)/,
  'Firestore provider 拉取数据时需要优先读取服务器，再回退到本地缓存'
);

assert.match(
  source,
  /waitForCommit\s*=\s*true/,
  'Firestore provider 写入应支持保存时不等待云端提交'
);

assert.match(
  source,
  /assignSeq\s*=\s*true/,
  'Firestore provider 写入应支持保存时跳过远端 seq 分配'
);

const sandbox = {
  window: {
    firebase: {
      apps: [],
      firestore: {
        FieldValue: {
          delete() {
            return { __delete__: true };
          }
        }
      },
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
  indexSource,
  /import \{ OrderTrackerProviderFirestore \} from '\.\/provider-firestore\.mjs'/,
  '订单 ESM 入口需要直接导入订单 Firestore provider'
);

assert.doesNotMatch(
  htmlSource,
  /<script src="js\/orders\/provider-firestore\.js" defer><\/script>/,
  'index.html 不应再加载旧订单 Firestore provider 普通脚本'
);

const configText = `const firebaseConfig = {
  apiKey: "AIza",
  authDomain: "demo.firebaseapp.com",
  projectId: "demo",
  appId: "1:web:demo"
};`;

provider.init({ configText })
  .then(() => provider.init({ configText }))
  .then(async () => {
    const providerModule = await import(pathToFileURL(esmPath).href);

    assert.deepEqual(
      providerModule.parseConfigInput(configText),
      provider.parseConfigInput(configText),
      'ESM Firestore provider 的配置解析结果应和旧模块一致'
    );

    assert.equal(
      providerModule.getDisplayName({ projectId: 'demo' }),
      'demo · Firestore',
      'ESM Firestore provider 应生成显示名'
    );

    assert.deepEqual(
      providerModule.normalizeOrderItems([
        {
          lineId: 'line-1',
          productTkId: 'TK-1',
          productSkuId: 'SKU-1',
          productSkuName: '黑 / XXL',
          productName: '雨衣 - 黑 / XXL',
          quantity: '2',
          unitPurchasePrice: '10.125',
          unitSalePrice: '300',
          unitWeightG: '120',
          unitSizeText: '20×10×5',
          useOrderCourier: true,
          courierCompany: '顺丰快递',
          trackingNo: 'SF123'
        }
      ]),
      [
        {
          lineId: 'line-1',
          productTkId: 'TK-1',
          productSkuId: 'SKU-1',
          productSkuName: '黑 / XXL',
          productName: '雨衣',
          quantity: 2,
          unitPurchasePrice: 10.13,
          unitSalePrice: 300,
          unitWeightG: 120,
          unitSizeText: '20×10×5',
          useOrderCourier: true,
          courierCompany: '顺丰快递',
          trackingNo: 'SF123'
        }
      ],
      'ESM Firestore provider 应归一化 items 并清洗重复 SKU 后缀'
    );

    const pulledOrder = providerModule.normalizePulledOrder({
      id: 'order-1',
      seq: 2,
      accountName: 'A',
      orderedAt: '2026-04-23',
      orderNo: 'ORDER-1',
      isRefunded: true,
      items: [
        {
          lineId: 'line-1',
          productTkId: 'TK-1',
          productSkuId: 'SKU-1',
          productSkuName: '白色',
          productName: '马克杯',
          quantity: 2,
          unitPurchasePrice: 10,
          unitSalePrice: 300,
          unitWeightG: 120,
          courierCompany: '顺丰快递',
          trackingNo: 'SF123'
        },
        {
          lineId: 'line-2',
          productTkId: 'TK-1',
          productSkuId: 'SKU-2',
          productSkuName: '黑色',
          productName: '马克杯',
          quantity: 3,
          unitPurchasePrice: 12,
          unitSalePrice: 320,
          unitWeightG: 140
        }
      ]
    });

    assert.equal(pulledOrder['产品名称'], '马克杯（白色 ×2，黑色 ×3）', 'ESM Firestore provider 拉取时应从 items 生成商品摘要');
    assert.equal(pulledOrder['数量'], '5', 'ESM Firestore provider 拉取时应汇总数量');
    assert.equal(pulledOrder['采购价格'], '56', 'ESM Firestore provider 拉取时应汇总采购价格');
    assert.equal(pulledOrder['售价'], '1560', 'ESM Firestore provider 拉取时应汇总售价');
    assert.equal(pulledOrder['是否退款'], '1', 'ESM Firestore provider 拉取时应映射退款字段');
    assert.equal(pulledOrder['快递公司'], '顺丰快递', 'ESM Firestore provider 拉取时应汇总快递公司');

    const orderDoc = providerModule.buildOrderDoc({
      id: 'order-1',
      seq: '3',
      createdAt: '2026-04-23T10:00:00.000Z',
      updatedAt: '2026-04-23T11:00:00.000Z',
      '账号': 'A',
      '下单时间': '2026-04-23',
      '订单号': 'ORDER-1',
      '是否退款': '1',
      '达人佣金率': '10',
      '达人佣金': '3',
      '预估运费': '6.5',
      '预估利润': '0.7',
      items: [
        {
          lineId: 'line-1',
          productTkId: 'TK-1',
          productSkuId: 'SKU-1',
          productSkuName: '黑 / XXL',
          productName: '雨衣 - 黑 / XXL',
          quantity: '2',
          unitPurchasePrice: '10',
          unitSalePrice: '300',
          unitWeightG: '120',
          unitSizeText: '20×10×5',
          courierCompany: '顺丰快递',
          trackingNo: 'SF123'
        }
      ]
    });

    assert.equal(orderDoc.productName, '雨衣（黑 / XXL ×2）', 'ESM Firestore provider 写入时应从 items 生成商品摘要');
    assert.equal(orderDoc.quantity, 2, 'ESM Firestore provider 写入时应汇总数量');
    assert.equal(orderDoc.purchasePrice, 20, 'ESM Firestore provider 写入时应汇总采购价格');
    assert.equal(orderDoc.salePrice, 600, 'ESM Firestore provider 写入时应汇总售价');
    assert.equal(orderDoc.isRefunded, true, 'ESM Firestore provider 写入时应映射退款字段');
    assert.deepEqual(
      orderDoc.items[0],
      {
        lineId: 'line-1',
        quantity: 2,
        productTkId: 'TK-1',
        productSkuId: 'SKU-1',
        productSkuName: '黑 / XXL',
        productName: '雨衣',
        unitPurchasePrice: 10,
        unitSalePrice: 300,
        unitWeightG: 120,
        unitSizeText: '20×10×5',
        courierCompany: '顺丰快递',
        trackingNo: 'SF123'
      },
      'ESM Firestore provider 写入 items 时应清洗重复 SKU 后缀且不写空字段'
    );

    console.log('orders firestore provider contract ok');
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
