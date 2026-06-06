import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(scriptDir, 'config.json'), 'utf8'));
const outputRoot = path.resolve(root, config.chuhaijiangOutputDir || 'data/collection/chuhaijiang/runs');
const args = parseArgs(process.argv.slice(2));
const strategy = normalizeStrategy(args.strategy || process.env.TK_SELECTION_STRATEGY || config.defaultStrategy || 'mixed-discovery');
const accountName = normalizeAccountOption(args.account || process.env.TK_COLLECTION_ACCOUNT);
if (!accountName) {
  console.error('缺少目标账号：请使用 --account <账号名>，例如 --account NOMA。');
  process.exit(1);
}

const inputPath = args.inputPath
  ? path.resolve(root, args.inputPath)
  : await latestProductsFile(outputRoot);

if (!inputPath) {
  console.error('没有找到 products.json，请先完成出海匠页面采集，并把页面结果保存到运行目录。');
  process.exit(1);
}

const outDir = path.dirname(inputPath);
const dedupe = await loadDedupeManifest(outDir);
const raw = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const records = uniqueRecords(flattenProductRecords(raw).map(normalizeRecord).filter(Boolean));

const candidates = [];
const rejects = [];
for (const record of records) {
  if (isOldProduct(record, dedupe)) {
    rejects.push(formatReject(record, '数据库已有旧商品，排除重复'));
    continue;
  }
  const reject = firstReject(record);
  if (reject) {
    rejects.push(formatReject(record, reject));
    continue;
  }
  candidates.push(scoreRecord(record));
}

candidates.sort((a, b) => b.score - a.score || b.product_7d_sold_count - a.product_7d_sold_count);

const ranked = candidates.map((candidate, index) => ({
  rank: index + 1,
  ...candidate
}));
const candidateRows = ranked.map((candidate) => formatCandidateRow(candidate, accountName));
const rejectRows = rejects.map((reject) => formatRejectRow(reject, accountName));

await fs.writeFile(path.join(outDir, 'selection_candidates.json'), JSON.stringify(candidateRows, null, 2));
await fs.writeFile(path.join(outDir, 'selection_rejects.json'), JSON.stringify(rejectRows, null, 2));
await writeCsv(path.join(outDir, 'selection_candidates.csv'), candidateRows, candidateHeaders());
await writeCsv(path.join(outDir, 'selection_rejects.csv'), rejectRows, rejectHeaders());

console.log(`输入文件：${inputPath}`);
console.log(`读取商品数：${records.length}`);
console.log(`机器候选数：${ranked.length}`);
console.log(`机器拒绝数：${rejects.length}`);
console.log(`数据库旧商品排除数：${rejects.filter((row) => row.reason === '数据库已有旧商品，排除重复').length}`);
console.log(`目标账号：${accountName}`);
console.log(`选品策略：${strategy}`);
console.log(`输出目录：${outDir}`);

function parseArgs(argv) {
  const options = { inputPath: '', account: '', strategy: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--account') {
      options.account = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--account=')) {
      options.account = arg.slice('--account='.length);
      continue;
    }
    if (arg === '--strategy') {
      options.strategy = argv[index + 1] || '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--strategy=')) {
      options.strategy = arg.slice('--strategy='.length);
      continue;
    }
    if (!arg.startsWith('--') && !options.inputPath) options.inputPath = arg;
  }
  return options;
}

function normalizeStrategy(value) {
  const text = String(value || '').trim();
  return text || 'mixed-discovery';
}

function normalizeAccountOption(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '【账号名】') return '';
  return text;
}

async function latestProductsFile(runsDir) {
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    for (const dir of dirs) {
      for (const filename of ['products.json', 'selected-detail-results.json', 'ready-for-dxm-test.json']) {
        const candidate = path.join(runsDir, dir, filename);
        try {
          await fs.access(candidate);
          return candidate;
        } catch {
          // 继续检查下一个候选文件。
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function loadDedupeManifest(dir) {
  const manifestPath = path.join(dir, 'dedupe_manifest.json');
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return {
      source: manifest?.source || '',
      oldProductIds: new Set(Array.isArray(manifest?.oldProductIds) ? manifest.oldProductIds.map(String) : []),
      oldProductUrls: new Set(Array.isArray(manifest?.oldProductUrls) ? manifest.oldProductUrls.map(normalizeUrl) : []),
      oldProductKeys: new Set(Array.isArray(manifest?.oldProductKeys) ? manifest.oldProductKeys.map(String) : [])
    };
  } catch {
    return { source: '', oldProductIds: new Set(), oldProductUrls: new Set(), oldProductKeys: new Set() };
  }
}

function flattenProductRecords(value, depth = 0) {
  if (value == null || depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenProductRecords(item, depth + 1));
  if (typeof value !== 'object') return [];

  if (looksLikeProductRecord(value)) return [value];
  const nestedKeys = ['products', 'items', 'rows', 'results', 'records', 'data', 'list'];
  const records = [];
  for (const key of nestedKeys) {
    if (value[key] !== undefined) records.push(...flattenProductRecords(value[key], depth + 1));
  }
  return records;
}

function looksLikeProductRecord(value) {
  if (!value || typeof value !== 'object') return false;
  if (value.listRecord || value.detail) return true;
  if (value.tiktokOfficialUrl || value.tkUrl || value.tiktokUrl) return true;
  if (value.productId || value.product_id || value.itemId || value.item_id) return true;
  return Boolean((value.title || value.name || value.rowText || value.rawText) && (value.productUrl || value.url || value.pageUrl));
}

function uniqueRecords(records) {
  const seen = new Set();
  const unique = [];
  for (const record of records) {
    const key = record.product_id || extractProductId(record.product_url) || normalizeUrl(record.product_url) || normalizeUrl(record.chuhaijiang_url) || normalizeText(record.product_name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function normalizeRecord(entry) {
  const list = entry.listRecord || entry.product || entry.item || entry;
  const detail = entry.detail || entry.productDetail || entry.detailRecord || {};
  const row = parseRowText(firstText(list.rowText, list.rawText, list.raw_text, detail.textSample, entry.rowText));
  const title = cleanProductName(firstText(
    detail.title,
    list.title,
    entry.title,
    detail.name,
    list.name,
    row.name
  ));
  const tiktokUrl = firstTiktokUrl(entry, detail, list);
  const productId = firstText(
    detail.productId,
    detail.product_id,
    list.productId,
    list.product_id,
    entry.productId,
    entry.product_id,
    extractProductId(tiktokUrl),
    extractProductId(detail.pageUrl),
    extractProductId(list.productUrl),
    extractProductId(entry.productUrl)
  );
  const chuhaijiangUrl = firstChuhaijiangUrl(entry, detail, list);
  const imageUrl = firstText(
    firstImageUrl(detail.firstImages),
    firstImageUrl(list.firstImages),
    detail.imageUrl,
    detail.image,
    list.imageUrl,
    list.image,
    entry.imageUrl,
    entry.image
  );

  return {
    raw: entry,
    list,
    detail,
    product_id: productId,
    product_name: title,
    product_category: categoryText(firstText(detail.category, list.category, entry.category, row.category)),
    shop_category: categoryText(firstText(detail.shopCategory, list.shopCategory, entry.shopCategory)),
    shop_name: firstText(detail.shopName, list.shopName, entry.shopName, row.shopName),
    product_price: firstText(detail.price, list.price, entry.price, row.price),
    product_7d_sold_count: firstFiniteNumber(
      numberValue(detail.near7Sales),
      numberValue(list.near7Sales),
      numberValue(entry.near7Sales),
      numberValue(findValue(entry, ['day7_sold_count', 'day7SoldCount', 'sales7d', 'product7dSales'])),
      row.near7Sales
    ),
    product_sales_amount: firstFiniteNumber(
      moneyNumber(detail.near7GmvJpy),
      moneyNumber(list.near7GmvJpy),
      moneyNumber(entry.near7GmvJpy),
      row.near7GmvJpy
    ),
    shop_total_sales_jpy: firstFiniteNumber(
      moneyNumber(detail.shopTotalGmv),
      moneyNumber(list.totalGmvJpy),
      moneyNumber(entry.totalGmvJpy),
      moneyNumber(findValue(entry, ['shopTotalGmv', 'shop_total_gmv', 'totalGmvJpy'])),
      row.totalGmvJpy
    ),
    shop_total_sales_count: firstFiniteNumber(
      numberValue(detail.shopTotalSales),
      numberValue(list.totalSales),
      numberValue(entry.totalSales),
      row.totalSales
    ),
    shop_day7_sold_count: firstFiniteNumber(
      numberValue(detail.shopNear7Sales),
      numberValue(detail.shop7dSales),
      numberValue(list.shopNear7Sales),
      numberValue(list.shop7dSales),
      numberValue(entry.shopNear7Sales),
      numberValue(entry.shop7dSales),
      numberValue(findValue(entry, ['shopDay7SoldCount', 'shop_day7_sold_count', 'shop7dSales', 'shopNear7Sales']))
    ),
    tiktok_url: tiktokUrl,
    product_url: tiktokUrl,
    chuhaijiang_url: chuhaijiangUrl,
    shop_url: firstText(detail.shopUrl, list.shopUrl, entry.shopUrl),
    image_url: imageUrl,
    listed_at: firstText(detail.listedAt, list.listedAt, entry.listedAt),
    source_query: firstText(list.query, entry.query, list.source, entry.source),
    row_text: firstText(list.rowText, list.rawText, detail.textSample, entry.rowText),
    status_text: firstText(detail.status, list.status, entry.status)
  };
}

function parseRowText(value) {
  const text = firstText(value).replace(/\s+/g, ' ').trim();
  if (!text) return {};
  const priceMatch = text.match(/JP¥\s*[0-9,]+(?:\s*-\s*JP¥?\s*[0-9,]+)?/) || text.match(/[¥￥]\s*[0-9,]+(?:\s*-\s*[¥￥]?\s*[0-9,]+)?/);
  const numbers = Array.from(text.matchAll(/(?:JP¥\s*)?[0-9,.]+万|JP¥\s*[0-9,.]+|[0-9,]+/g)).map((match) => match[0]);
  const near7Sales = numbers.length >= 2 ? numberValue(numbers[numbers.length - 4]) : NaN;
  const totalSales = numbers.length >= 2 ? numberValue(numbers[numbers.length - 3]) : NaN;
  const near7GmvJpy = numbers.length >= 2 ? moneyNumber(numbers[numbers.length - 2]) : NaN;
  const totalGmvJpy = numbers.length >= 1 ? moneyNumber(numbers[numbers.length - 1]) : NaN;
  return {
    name: priceMatch ? text.slice(0, priceMatch.index).trim() : '',
    price: priceMatch ? priceMatch[0].replace(/\s+/g, '') : '',
    near7Sales,
    totalSales,
    near7GmvJpy,
    totalGmvJpy
  };
}

function cleanProductName(value) {
  return firstText(value)
    .replace(/\s*\|\s*出海匠\s*$/i, '')
    .replace(/\s*JP¥.*$/i, '')
    .trim();
}

function firstTiktokUrl(...objects) {
  const names = [
    'tiktokOfficialUrl',
    'tiktok_official_url',
    'tkUrl',
    'tiktokUrl',
    'tiktok_url',
    'tk_product_url',
    'product_url',
    'productUrl',
    '商品链接'
  ];
  for (const object of objects) {
    const value = firstText(findValue(object, names));
    if (/tiktok\.com\/view\/product/i.test(value)) return value;
  }
  return '';
}

function firstChuhaijiangUrl(...objects) {
  const names = ['chuhaijiangUrl', 'chuhaijiang_url', 'pageUrl', 'productUrl', 'product_url', 'url', '出海匠链接'];
  for (const object of objects) {
    const value = firstText(findValue(object, names));
    if (/chuhaijiang\.com/i.test(value)) return value;
  }
  return '';
}

function firstImageUrl(value) {
  if (Array.isArray(value)) {
    const item = value.find((image) => firstText(image?.src || image?.url));
    return firstText(item?.src || item?.url);
  }
  if (value && typeof value === 'object') return firstText(value.src || value.url);
  return firstText(value);
}

function firstReject(record) {
  const text = hardRiskText(record);
  const productText = productSearchableText(record);
  if (!record.product_name) return '缺少商品名称，无法判断';
  if (!record.product_url || !/tiktok\.com\/view\/product/i.test(record.product_url)) return '出海匠详情页未取得 TikTok 官方商品链接';
  if (!Number.isFinite(record.product_7d_sold_count) || record.product_7d_sold_count <= 0) return '商品近7天销量为空或小于等于 0';
  if (matchesAny(text, ['已下架', '下架', '售罄', '缺货', 'sold out', 'out of stock', 'unavailable'])) return '商品不是在售状态';

  const checks = [
    ['食品/入口接触监管风险', ['食品', 'food', '米', 'お米', 'サプリ', 'supplement', 'お菓子', 'スナック', 'tea', 'coffee', 'プロテイン', 'protein', 'ビタミン', 'vitamin', '水筒', 'ボトル', 'bottle', 'ストロー', 'straw', 'カップ', 'cup', 'マグ', 'mug', '弁当箱', 'ランチボックス', '食器']],
    ['液体/膏体/喷雾风险', ['液体', 'リキッド', 'オイル', 'oil', 'spray', 'スプレー', 'ローション', 'lotion', 'ジェル', 'gel', 'シャンプー', 'shampoo', 'serum', '美容液']],
    ['美妆/身体护理/医疗监管风险', ['フェイス', '顔マッサージ', 'かっさ', '美容', 'メイク', '化粧', 'cosmetic', 'beauty', 'ネイル', 'nail', '薬', 'medicine', 'medical', '医療', 'ヘルスケア', 'health care', 'リハビリ', '姿勢矯正', '矯正', '血圧', '体温計', 'thermometer']],
    ['带电/电池/插电/灯具风险', ['usb充電', '充電式', '内蔵バッテリー', 'バッテリー', 'battery', '電池', 'リチウム', 'lithium', '電動', 'コンセント', '電源コード', 'ac100v', '110v', '220v', 'plug', 'ヒーター', 'heater', 'led', 'ライト', 'lamp', 'bluetooth', 'wireless', 'ワイヤレス', 'リモコン']],
    ['强磁/磁性风险', ['マグネット', 'magnet', '磁石', '磁気', '磁性']],
    ['明显 IP/角色/品牌风险', ['ディズニー', 'disney', 'サンリオ', 'sanrio', 'ポケモン', 'pokemon', 'pikachu', 'ピカチュウ', 'mickey', 'ミッキー', 'hello kitty', 'キティ', 'クロミ', 'ちいかわ', 'anime', 'アニメ', 'キャラクター']],
    ['眼镜/镜片风险', ['サングラス', '眼科', '偏光', '調光', 'uv400', 'レンズ', 'lens', '眼鏡', 'メガネ', '眼镜', 'glasses', 'コンタクト', 'contact lens']],
    ['首饰吊坠/钥匙扣/带扣风险', ['チャーム', 'charm', 'パール', 'pearl', 'ビジュー', 'キスロック', 'キーリング', 'キーホルダー', 'keychain', 'key ring', 'ペンダント', 'pendant', 'ネックレス', 'necklace', 'ブレスレット', 'bracelet', 'ピアス', 'earring', 'イヤリング', 'ジュエリー', 'jewelry', 'バックル', 'buckle', 'clasp', 'チェーン', 'chain', 'カラビナ', 'carabiner', 'ラインストーン', '吊坠', '项链', '手链', '耳环', '首饰', '钥匙扣', '带扣', '手机吊饰']],
    ['大件/架子/家具风险', ['ラック', 'シューズラック', '物干し', '椅子', 'チェア', 'chair', '棚', 'シェルフ', 'shelf', '収納ラック', 'ワゴン', 'カート', 'cart', 'ソファ', 'sofa', 'テーブル', 'table', 'ベッド', 'bed', '家具', 'furniture', 'ペットベッド', 'pet bed', '置物架', '收纳架', '架子', '层架', '推车', '宠物床']],
    ['工具/尖锐/园艺风险', ['除草', '雑草', '園芸工具', 'レーキ', 'スクレーパー', 'ナイフ', 'knife', '刃', '包丁', 'cutter', 'カッター', 'razor', '針', 'needle', 'はさみ', 'scissors', 'saw', 'のこぎり', 'drill', 'ドリル', 'hammer', 'ハンマー', 'wrench', 'レンチ', 'screwdriver', 'ドライバー', 'plier', 'プライヤー', 'ペンチ']],
    ['汽车/摩托相关风险', ['洗車', '自動車', '車用', '車載', '車内', '汽车', '汽車', '车用', '车载', 'automotive', 'motorcycle', 'バイク', 'moto', 'tesla', 'トヨタ', 'toyota', 'mazda', 'マツダ']],
    ['易碎玻璃/陶瓷/镜面风险', ['glass', 'ガラス', 'ceramic', '陶器', 'porcelain', '磁器', 'mirror', 'ミラー', '鏡', 'crystal', 'fragile', '割れ', '玻璃', '陶瓷', '镜子']],
    ['大件运动器械风险', ['フラフープ', 'hula hoop', 'フィットネス機械', 'パワーツイスター', 'training board', 'トレーニング器具', 'fitness equipment', '握力トレーナー', '腕相撲']],
    ['长杆/球拍/运动器械风险', ['ラケット', 'racket', 'racquet', 'テニス', 'tennis', 'バドミントン', 'badminton', 'バット', 'bat', 'ゴルフ', 'golf', 'ポール', 'pole', '登山杖', '球拍', '长杆']],
    ['大垫/地毯/不可压缩风险', ['ヨガマット', 'yoga mat', 'ラグ', 'rug', 'カーペット', 'carpet']],
    ['手机壳/贴膜/贴纸暂不支持风险', ['スマホケース', 'スマートフォンケース', 'phone case', 'iphone case', 'screen protector', '保護フィルム', 'ガラスフィルム', 'sticker', 'ステッカー', 'シール']],
    ['香薰/驱虫/燃烧品监管风险', ['線香', 'お香', 'incense', 'インセンス', 'アロマ', '蚊よけ', '防虫剤', '害虫', '駆除', 'ゴキブリ', 'ネズミ', 'ダニ', '超音波', '虫よけ']],
    ['植物/干花/花材风险', ['ドライフラワー', 'dry flower', 'プリザーブドフラワー', 'ソープフラワー', 'かすみ草', 'ブーケ', '花材', '植物']],
    ['玩具/人偶暂不支持风险', ['ぬいぐるみ', 'plush', 'doll', '人形', 'フィギュア', 'figure', 'toy figure', 'action figure', 'toy', '玩具']]
  ];

  if (!isShoeLaundryAccessory(productText) && matchesAny(productText, ['靴', 'シューズ', 'shoes', 'スニーカー', 'サンダル', 'ブーツ'])) {
    return '鞋靴尺码退货风险';
  }
  if (!isStorageOrCover(productText) && matchesAny(productText, ['ワンピース', 'dress', 'pants', 'ズボン', 'シャツ', 'パーカー', 'トップス', '長袖', 'ブラジャー', '下着'])) {
    return '服装尺码退货风险';
  }

  for (const [reason, keywords] of checks) {
    if (reason === '大件/架子/家具风险' && isFurnitureLegCover(productText)) continue;
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) return reason;
  }

  const weightKg = normalizedWeightKg(findValue(record.raw, ['weight_kg', 'weightKg', 'weight']));
  if (Number.isFinite(weightKg) && weightKg > 2) return '超过 2kg 小卖家重量风险';

  const dimensions = [
    numberValue(findValue(record.raw, ['length', 'length_cm', 'lengthCm'])),
    numberValue(findValue(record.raw, ['width', 'width_cm', 'widthCm'])),
    numberValue(findValue(record.raw, ['height', 'height_cm', 'heightCm']))
  ].filter(Number.isFinite);
  if (dimensions.length && Math.max(...dimensions) > 40 && !isRollableFoldable(text)) return '长边超过 40cm 小卖家尺寸风险';

  if (strategy === 'small-shop-filter') {
    if (!Number.isFinite(record.shop_total_sales_jpy) || record.shop_total_sales_jpy < config.shopTotalSalesMin || record.shop_total_sales_jpy > config.shopTotalSalesMax) {
      return 'small-shop-filter 策略要求店铺总销售额在 10,000-80,000 日元内';
    }
    if (!Number.isFinite(record.shop_day7_sold_count) || record.shop_day7_sold_count < config.shop7dSalesMin) {
      return 'small-shop-filter 策略要求店铺近7天销量大于0';
    }
  }

  return '';
}

function isOldProduct(record, dedupe) {
  if (!dedupe || dedupe.source !== 'firestore') return false;
  if (record.product_id && dedupe.oldProductIds.has(String(record.product_id))) return true;
  const productUrl = normalizeUrl(record.product_url);
  const sourceUrl = normalizeUrl(record.chuhaijiang_url);
  const key = getProductKey(record);
  return Boolean((productUrl && dedupe.oldProductUrls.has(productUrl))
    || (sourceUrl && dedupe.oldProductUrls.has(sourceUrl))
    || (key && dedupe.oldProductKeys.has(key)));
}

function scoreRecord(record) {
  let score = 55;
  const reasons = [];
  const flags = [];
  const text = searchableText(record);
  const productText = productSearchableText(record);
  const categoryTextValue = `${record.product_category} ${record.shop_category}`.toLowerCase();

  add(10, '出海匠详情页已取得 TikTok 官方商品链接');
  if (record.product_7d_sold_count >= 1) add(10, '商品近7天有真实成交');
  if (record.product_7d_sold_count >= 5) add(4, '商品近7天销量达到 5+');
  if (record.product_7d_sold_count >= 20) add(4, '商品近7天销量达到 20+');
  if (record.product_7d_sold_count >= 100) add(-4, '销量较高，后续要检查竞争是否过热');

  if (matchesAny(categoryTextValue, ['居家', '清洁', '家居', '収納', '收纳', '百洁布', 'ポーチ', '日用', 'home', 'household', 'cleaning', 'storage', 'fabric', 'textile'])) {
    add(12, '类目符合轻小日用/收纳/清洁偏好');
  } else if (matchesAny(categoryTextValue, ['バッグ', 'bag', 'office', 'computer', '办公'])) {
    add(8, '类目可做轻小软包/办公配件');
  }

  if (isRollableFoldable(text)) add(8, '可折叠/可卷/可压缩，物流形态有机会');
  if (matchesAny(text, ['セット', 'set', 'pack', 'pcs', '個入', '枚入', '本入', '2枚', '10枚'])) add(6, '有组合装/多件装机会');
  if (matchesAny(text, ['洗濯ネット', 'ゴミ取りネット', 'フィルター', '防塵カバー', 'ダストカバー', '収納袋', '収納バッグ', 'トラベルポーチ', 'ポーチ', 'クロス', 'カバー'])) {
    add(10, '轻小日用/软材质/替换耗材方向明确');
  }
  if (matchesAny(text, ['洗濯', '掃除', '収納', '旅行', 'トラベル', 'クローゼット', 'キッチン', '靴', 'シューズ'])) {
    add(5, '有明确使用场景，方便做标题和内容角度');
  }
  if (record.product_price) add(2, '价格字段可读');

  for (const flag of softRiskFlags(productText, categoryTextValue)) {
    if (!flags.includes(flag)) flags.push(flag);
  }

  const demandScene = demandSceneFor(text, categoryTextValue);
  const smallSellerOpportunity = opportunityFor(text, categoryTextValue);
  const suggestedAction = score >= 82
    ? '优先人工复核图片/尺寸/货源'
    : score >= 68
      ? '进入备选池，复核风险后再找货'
      : '暂缓，除非有明显货源优势';

  return {
    score,
    candidate: record.product_name || record.product_id || '(未知商品)',
    product_id: record.product_id,
    shop_name: record.shop_name,
    product_category: record.product_category,
    shop_category: record.shop_category,
    product_price: record.product_price,
    product_7d_sold_count: record.product_7d_sold_count,
    product_sales_amount: record.product_sales_amount,
    shop_total_sales_jpy: record.shop_total_sales_jpy,
    shop_total_sales_count: record.shop_total_sales_count,
    shop_day7_sold_count: record.shop_day7_sold_count,
    demand_scene: demandScene,
    small_seller_opportunity: smallSellerOpportunity,
    risk_flags: flags.join('；'),
    suggested_action: suggestedAction,
    score_reasons: reasons.join('；'),
    product_url: record.product_url,
    chuhaijiang_url: record.chuhaijiang_url,
    shop_url: record.shop_url,
    image_url: record.image_url
  };

  function add(points, reason) {
    score += points;
    reasons.push(`${points > 0 ? '+' : ''}${points}: ${reason}`);
  }
}

function formatReject(record, reason) {
  return {
    reason,
    candidate: record.product_name || record.product_id || '(未知商品)',
    product_id: record.product_id,
    shop_name: record.shop_name,
    product_category: record.product_category,
    shop_category: record.shop_category,
    product_7d_sold_count: record.product_7d_sold_count,
    shop_total_sales_jpy: record.shop_total_sales_jpy,
    strategy,
    product_url: record.product_url,
    chuhaijiang_url: record.chuhaijiang_url,
    shop_url: record.shop_url
  };
}

function demandSceneFor(text, categoryTextValue) {
  if (matchesAny(text, ['洗濯', 'ランドリー'])) return '洗衣/衣物护理耗材场景';
  if (matchesAny(text, ['掃除', 'cleaning', 'クロス', 'ブラシ'])) return '清洁维护场景';
  if (matchesAny(text, ['収納', 'storage', 'organizer', 'クローゼット'])) return '家庭收纳整理场景';
  if (matchesAny(text, ['旅行', 'トラベル', 'travel'])) return '旅行收纳便携场景';
  if (matchesAny(text, ['desk', 'デスク', 'office', 'パソコン', 'pc'])) return '桌面办公/电脑周边场景';
  if (matchesAny(categoryTextValue, ['home', 'household', '居家'])) return '居家日用场景';
  return '需求场景待人工确认';
}

function opportunityFor(text, categoryTextValue) {
  const opportunities = [];
  if (matchesAny(text, ['セット', 'set', 'pack', 'pcs', '個入', '枚入', '本入'])) opportunities.push('可测多件装/组合装');
  if (matchesAny(text, ['カバー', 'cover', 'ケース', 'case', 'ホルダー', 'holder', 'ポーチ', 'pouch', 'バッグ', 'bag'])) opportunities.push('小配件/软收纳长尾词机会');
  if (matchesAny(text, ['洗濯', '掃除', '収納', '旅行', 'トラベル'])) opportunities.push('可做场景化标题和短视频开头');
  if (matchesAny(categoryTextValue, ['清洁', '収納', 'storage', 'fabric', 'textile'])) opportunities.push('类目贴近小卖家偏好');
  return opportunities.length ? opportunities.join('；') : '需人工判断是否能避开大卖家正面竞争';
}

function softRiskFlags(text, categoryTextValue) {
  const flags = [];
  if (matchesAny(text, ['キッチン', 'kitchen', '厨房'])) flags.push('厨房场景需复核是否入口接触，本品若只是外罩/收纳才可继续');
  if (matchesAny(text, ['服', '衣類', 'スーツ', 'コート']) && isStorageOrCover(text)) flags.push('衣物收纳/罩类需复核尺寸，确认可折叠压缩');
  if (matchesAny(text, ['バッグ', 'bag', 'ポーチ', 'pouch'])) flags.push('包袋类需复核容量、五金件和品牌词');
  if (matchesAny(text, ['シリコン', 'ゴム', '樹脂', '不織布', 'メッシュ'])) flags.push('材质需在 1688 找货时核验');
  if (matchesAny(categoryTextValue, ['美妆', 'beauty']) && !matchesAny(text, ['掃除', '清洁', '洗濯', '収納'])) flags.push('店铺类目偏美妆，需复核商品实际类目');
  return flags;
}

function isRollableFoldable(text) {
  return matchesAny(text, [
    '折りたたみ', '折り畳み', '折叠', '折疊', 'foldable', 'folding',
    'ロール', '巻き', '卷', '捲', 'rollable', 'rolled',
    '圧縮', '压缩', '壓縮', 'compressible', 'compression',
    '布製', 'キャンバス', 'ナイロン', 'シリコン', 'ゴム製', '不織布', 'メッシュ', '布', '帆布', '硅胶', '橡胶',
    'マウスパッド', 'mouse pad', 'mousepad', 'デスクマット', 'desk mat'
  ]);
}

function isStorageOrCover(text) {
  return matchesAny(text, ['収納', 'カバー', 'ケース', 'ポーチ', 'バッグ', '袋', '圧縮', '防塵', '保護']);
}

function isShoeLaundryAccessory(text) {
  return matchesAny(text, ['洗濯ネット', '洗浄ネット', 'シューズ洗浄', '靴洗い', '靴用ネット', 'シューズ保護ケース']);
}

function isFurnitureLegCover(text) {
  return matchesAny(text, [
    '家具脚カバー',
    '椅子脚カバー',
    'チェアレッグカバー',
    '椅子キャップ',
    '脚保護カバー',
    'chair leg cover',
    'chair leg cap',
    'furniture leg cover',
    'キャスターカバー'
  ]);
}

function getProductKey(record) {
  return record.product_id || extractProductId(record.product_url) || normalizeUrl(record.product_url) || normalizeText(record.product_name);
}

function extractProductId(value) {
  const text = String(value || '');
  const fromProductPath = text.match(/\/product\/(\d{10,})/);
  if (fromProductPath) return fromProductPath[1];
  const fromChuhaijiang = text.match(/\/products\/(\d{10,})/);
  if (fromChuhaijiang) return fromChuhaijiang[1];
  const fromImage = text.match(/p-(\d{10,})/);
  if (fromImage) return fromImage[1];
  const digits = text.match(/\b\d{10,}\b/);
  return digits ? digits[0] : '';
}

function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return text.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function searchableText(record) {
  return [
    record.product_name,
    record.product_category,
    record.shop_category,
    record.product_price,
    record.row_text,
    firstText(record.detail?.textSample)
  ].join(' ').toLowerCase();
}

function hardRiskText(record) {
  return [
    record.product_name,
    record.product_category,
    record.shop_category,
    record.product_price,
    record.row_text,
    record.status_text
  ].join(' ').toLowerCase();
}

function productSearchableText(record) {
  return [
    record.product_name,
    record.product_price,
    record.row_text
  ].join(' ').toLowerCase();
}

function matchesAny(text, needles) {
  const haystack = String(text || '').toLowerCase();
  return needles.some((needle) => haystack.includes(String(needle).toLowerCase()));
}

function findValue(value, names, depth = 0) {
  if (value == null || depth > 4) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, names, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value !== 'object') return undefined;

  const normalizedNames = names.map(normalizeKey);
  for (const [key, child] of Object.entries(value)) {
    if (normalizedNames.includes(normalizeKey(key))) return child;
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      const found = findValue(child, names, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function numberValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const text = value.trim();
  if (!text || text === '—' || text === '-') return NaN;
  const multiplier = text.includes('万') ? 10000 : text.toLowerCase().includes('k') ? 1000 : 1;
  const number = Number.parseFloat(text.replace(/[,，￥¥円日元$JP¥\s]/g, '').replace(/万|k/gi, ''));
  return Number.isFinite(number) ? number * multiplier : NaN;
}

function moneyNumber(value) {
  if (typeof value === 'number') return value;
  const text = firstText(value);
  if (!text || text === '—' || text === '-') return NaN;
  const multiplier = /万|萬/.test(text) ? 10000 : 1;
  const number = Number.parseFloat(text.replace(/[,，￥¥円日元$JP¥万萬\s]/g, ''));
  return Number.isFinite(number) ? number * multiplier : NaN;
}

function normalizedWeightKg(value) {
  const text = firstText(value).toLowerCase();
  if (!text) return NaN;
  const number = numberValue(text);
  if (!Number.isFinite(number)) return NaN;
  if (text.includes('g') && !text.includes('kg')) return number / 1000;
  return number;
}

function firstFiniteNumber(...values) {
  return values.find(Number.isFinite) ?? NaN;
}

function firstText(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const text = value.map((item) => firstText(item)).find(Boolean);
      if (text) return text;
      continue;
    }
    if (typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function categoryText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ');
  return firstText(value);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function candidateHeaders() {
  return [
    '账号',
    '选品分',
    '商品ID',
    '商品名称',
    '店铺名',
    '商品类目',
    '店铺类目',
    '商品价格',
    '商品近7天销量',
    '店铺总销售额（日元）',
    '近7天销售额（日元）',
    '需求场景与机会',
    '选品判断',
    '选品策略',
    '商品链接',
    '出海匠链接',
    '店铺链接',
    '图片链接',
    '是否旧商品',
    '是否计入本次'
  ];
}

function rejectHeaders() {
  return [
    '账号',
    '拒绝原因',
    '商品ID',
    '商品名称',
    '店铺名',
    '商品类目',
    '店铺类目',
    '商品近7天销量',
    '店铺总销售额（日元）',
    '选品策略',
    '商品链接',
    '出海匠链接',
    '店铺链接',
    '是否旧商品',
    '是否计入本次'
  ];
}

function formatCandidateRow(record, targetAccount) {
  return {
    '账号': targetAccount,
    '选品分': record.score,
    '商品ID': record.product_id,
    '商品名称': record.candidate,
    '店铺名': record.shop_name,
    '商品类目': record.product_category,
    '店铺类目': record.shop_category,
    '商品价格': record.product_price,
    '商品近7天销量': record.product_7d_sold_count,
    '店铺总销售额（日元）': record.shop_total_sales_jpy,
    '近7天销售额（日元）': record.product_sales_amount,
    '需求场景与机会': [record.demand_scene, record.small_seller_opportunity].filter(Boolean).join('；'),
    '选品判断': buildSelectionJudgementText(record),
    '选品策略': strategy,
    '商品链接': record.product_url,
    '出海匠链接': record.chuhaijiang_url,
    '店铺链接': record.shop_url,
    '图片链接': record.image_url,
    '是否旧商品': '否',
    '是否计入本次': '是'
  };
}

function formatRejectRow(record, targetAccount) {
  return {
    '账号': targetAccount,
    '拒绝原因': record.reason,
    '商品ID': record.product_id,
    '商品名称': record.candidate,
    '店铺名': record.shop_name,
    '商品类目': record.product_category,
    '店铺类目': record.shop_category,
    '商品近7天销量': record.product_7d_sold_count,
    '店铺总销售额（日元）': record.shop_total_sales_jpy,
    '选品策略': strategy,
    '商品链接': record.product_url,
    '出海匠链接': record.chuhaijiang_url,
    '店铺链接': record.shop_url,
    '是否旧商品': record.reason === '数据库已有旧商品，排除重复' ? '是' : '否',
    '是否计入本次': '否'
  };
}

function buildSelectionJudgementText(record) {
  const parts = [
    record.score_reasons,
    record.risk_flags ? `需复核：${record.risk_flags}` : '',
    record.suggested_action
  ].map(value => String(value || '').trim()).filter(Boolean);
  return parts.join('；');
}

async function writeCsv(file, records, headers) {
  const lines = [
    headers.join(','),
    ...records.map((record) => headers.map((header) => csvCell(record[header])).join(','))
  ];
  await fs.writeFile(file, lines.join('\n'));
}

function csvCell(value) {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
