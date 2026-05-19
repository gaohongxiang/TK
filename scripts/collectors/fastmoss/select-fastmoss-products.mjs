import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await fs.readFile(path.join(scriptDir, 'config.json'), 'utf8'));
const outputRoot = path.resolve(root, config.outputDir || 'data/collection/fastmoss/runs');
const args = parseArgs(process.argv.slice(2));
const accountName = normalizeAccountOption(args.account || process.env.TK_COLLECTION_ACCOUNT);
if (!accountName) {
  console.error('缺少目标账号：请使用 --account <账号名>，例如 --account NOMA。');
  process.exit(1);
}
const inputPath = args.inputPath
  ? path.resolve(root, args.inputPath)
  : await latestProductsFile(outputRoot);

if (!inputPath) {
  console.error('没有找到 products.json，请先完成 FastMoss 页面采集，并把页面结果保存到运行目录。');
  process.exit(1);
}

const outDir = path.dirname(inputPath);
const dedupe = await loadDedupeManifest(outDir);
const raw = JSON.parse(await fs.readFile(inputPath, 'utf8'));
const records = Array.isArray(raw) ? raw.map(normalizeRecord).filter(Boolean) : [];

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
console.log(`输出目录：${outDir}`);

function parseArgs(argv) {
  const options = { inputPath: '', account: '' };
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
    if (!arg.startsWith('--') && !options.inputPath) options.inputPath = arg;
  }
  return options;
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
      const candidate = path.join(runsDir, dir, 'products.json');
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // 继续检查下一个运行目录。
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

function normalizeRecord(entry) {
  const shop = entry.shop || {};
  const product = entry.product || entry;
  const productRow = parseProductRowText(product.raw_text || product.rawText || product.row_text);
  const shopRow = parseShopRowText(shop.raw_text || shop.rawText || shop.row_text);
  const rawProductName = stringValue(findValue(product, [
    'title',
    'product_name',
    'productName',
    'goods_name',
    'goodsName',
    'item_name',
    'itemName',
    'name'
  ])) || productRow.name;
  const productId = stringValue(findValue(product, [
    'product_id',
    'productId',
    'goods_id',
    'goodsId',
    'item_id',
    'itemId',
    'id'
  ]));
  const productCategory = categoryText(findValue(product, [
    'category_name',
    'categoryName',
    'cate_name',
    'cateName',
    'category',
    'category_list',
    'categoryList'
  ]) || productRow.category);
  const shopCategory = categoryText(shop.shop_info?.category_list || shop.shop_info?.category_name || shop.category_name || shopRow.category);
  const product7dSoldFromField = numberValue(findValue(product, [
    'day7_sold_count',
    'day7SoldCount',
    'day7_sale_count',
    'sale_count',
    'sold_count',
    'sales',
    'product_sold_count',
    'product_sale_count',
    'inc_sold_count',
    'order_count',
    'volume'
  ]));
  const product7dSold = firstFiniteNumber(productRow.day7SoldCount, product7dSoldFromField);
  const productSalesAmount = firstFiniteNumber(productRow.day7SaleAmount, numberValue(findValue(product, [
    'day7_sale_amount',
    'sale_amount',
    'sales_amount',
    'amount',
    'gmv',
    'revenue'
  ])));

  const shopTotalSales = firstFiniteNumber(
    numberValue(shop.total_sales_jpy || shop.shop_total_sales_jpy || shop.total_sales || shop.totalSaleAmount || shop.total_sale_amount),
    shopRow.totalSalesJpy,
    numberValue(shop.sale_amount || shop.sales_amount)
  );

  return {
    raw: entry,
    shop,
    product,
    seller_id: stringValue(shop.seller_id || shop.shop_info?.seller_id || shop.shop_info?.id),
    shop_name: cleanShopName(stringValue(shop.shop_info?.name || shop.shop_name || shop.name || shopRow.name), shopCategory),
    shop_category: shopCategory,
    shop_total_sales_jpy: shopTotalSales,
    shop_day7_sold_count: firstFiniteNumber(numberValue(shop.day7_sold_count || shop.shop7dSalesValue), shopRow.day7SoldCount),
    shop_day7_sale_amount_jpy: numberValue(shop.day7_sale_amount),
    shop_url: stringValue(shop.seller_id ? `https://www.fastmoss.com/zh/shop-marketing/detail/${shop.seller_id}` : ''),
    product_id: productId,
    product_name: cleanProductName(rawProductName),
    product_category: productCategory,
    product_price: stringValue(findValue(product, ['price_show', 'priceShow', 'price', 'min_price', 'minPrice'])) || productRow.price,
    product_7d_sold_count: product7dSold,
    product_sales_amount: productSalesAmount,
    product_url: productUrl(product, productId),
    image_url: stringValue(findValue(product, [
      'image',
      'img',
      'cover',
      'cover_url',
      'coverUrl',
      'product_image',
      'productImage'
    ]))
  };
}

function parseProductRowText(value) {
  const text = stringValue(value).replace(/\s+/g, ' ').trim();
  if (!text) return {};
  const priceMatch = text.match(/售价[:：]\s*([0-9,]+(?:\.[0-9]+)?円(?:\s*-\s*[0-9,]+(?:\.[0-9]+)?円)?)/)
    || text.match(/[¥￥]\s*([0-9,]+(?:\.[0-9]+)?(?:\s*-\s*[0-9,]+(?:\.[0-9]+)?)?)/);
  const dateMatch = text.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\(GMT\+8\)/);
  const categoryMatch = dateMatch ? text.slice(0, dateMatch.index).match(/日本\s+(.+)$/) : null;
  const tailMatch = text.match(/\(GMT\+8\)\s*-\s*([0-9,]+)\s+円\s*([0-9,.]+(?:万|萬)?)/);
  return {
    name: priceMatch ? text.slice(0, priceMatch.index).trim() : '',
    price: priceMatch ? priceMatch[1].replace(/\s+/g, '') : '',
    category: categoryMatch ? categoryMatch[1].trim() : '',
    day7SoldCount: tailMatch ? numberValue(tailMatch[1]) : NaN,
    day7SaleAmount: tailMatch ? moneyNumber(tailMatch[2]) : NaN
  };
}

function parseShopRowText(value) {
  const text = stringValue(value).replace(/\s+/g, ' ').trim();
  if (!text) return {};
  const knownCategories = ['美妆个护', '女装与女士内衣', '保健', '时尚配件', '运动与户外', '手机与数码', '居家日用', '食品饮料', '厨房用品', '玩具和爱好', '母婴用品', '电脑办公', '家纺布艺', '宠物用品', '工具五金', '汽车与摩托车'];
  const category = knownCategories.find((item) => text.includes(item)) || '';
  const name = category ? text.slice(0, text.indexOf(category)).trim() : '';
  const amounts = Array.from(text.matchAll(/[¥￥円]\s*([0-9,.]+(?:万|萬)?)/g))
    .map((match) => moneyNumber(match[1]))
    .filter(Number.isFinite);
  const totalSalesJpy = amounts.find((amount) => amount >= 10000 && amount <= 80000) ?? amounts[0] ?? NaN;
  const day7Match = text.match(/[¥￥円]\s*[0-9,.]+(?:万|萬)?\s+\([^)]*\)\s+([0-9,]+)/);
  return {
    name,
    category,
    totalSalesJpy,
    day7SoldCount: day7Match ? numberValue(day7Match[1]) : NaN
  };
}

function cleanProductName(value) {
  return stringValue(value)
    .replace(/\s*售价[:：].*$/i, '')
    .replace(/\s+日本\s+.+?\s+\d{4}-\d{2}-\d{2}.*$/i, '')
    .trim();
}

function cleanShopName(value, category) {
  const text = stringValue(value);
  if (!text || !category) return text;
  const index = text.indexOf(category);
  return index > 0 ? text.slice(0, index).trim() : text;
}

function firstFiniteNumber(...values) {
  return values.find(Number.isFinite) ?? NaN;
}

function moneyNumber(value) {
  const text = stringValue(value);
  if (!text) return NaN;
  const multiplier = /万|萬/.test(text) ? 10000 : 1;
  const number = Number.parseFloat(text.replace(/[,，￥¥円日元$万萬\s]/g, ''));
  return Number.isFinite(number) ? number * multiplier : NaN;
}

function firstReject(record) {
  const text = searchableText(record);
  const checks = [
    ['液体/膏体/喷雾风险', ['液体', 'リキッド', 'オイル', 'oil', 'spray', 'スプレー', 'ローション', 'lotion', 'ジェル', 'gel', 'シャンプー', 'shampoo', 'serum', '美容液']],
    ['带电池/锂电/无线电子风险', ['バッテリー', 'battery', '電池', 'リチウム', 'lithium', 'power bank', 'モバイルバッテリー', 'bluetooth', 'wireless', 'ワイヤレス', 'リモコン', 'remote control', 'イヤホン', 'ヘッドホン', 'ヘッドフォン', 'earphone', 'earphones', 'headphone', 'headphones', 'headset']],
    ['插电/电压/电器风险', ['コンセント', '電源コード', 'ac100v', '110v', '220v', 'plug', 'heater', 'ヒーター', '加湿器', '電動', 'electric', '電子', 'electronic']],
    ['明显 IP/角色/品牌风险', ['ディズニー', 'disney', 'サンリオ', 'sanrio', 'ポケモン', 'pokemon', 'pikachu', 'ピカチュウ', 'mickey', 'ミッキー', 'hello kitty', 'キティ', 'クロミ', 'ちいかわ', 'anime', 'アニメ', 'キャラクター']],
    ['食品/入口/监管风险', ['食品', 'food', 'サプリ', 'supplement', 'お菓子', 'スナック', 'tea', 'coffee', 'プロテイン', 'protein', 'ビタミン', 'vitamin', 'ペットフード', 'cat food', 'dog food', '猫餌', '犬餌']],
    ['美妆/药品/医疗监管风险', ['cosmetic', '化粧', 'メイク', 'makeup', 'beauty', 'ネイル', 'nail', '薬', 'medicine', 'medical', '医療', 'ヘルスケア', 'health care', 'リハビリ', '姿勢矯正', '矯正', '医療用マスク', 'medical mask', 'surgical mask', '血圧', '体温計', 'thermometer', 'アキレス腱炎', '足底筋膜炎', 'シンスプリント', 'ストレッチャー']],
    ['厨房电器高风险', ['ミキサー', 'blender']],
    ['手机壳/贴膜/贴纸暂不支持风险', ['スマホケース', 'スマートフォンケース', 'phone case', 'iphone case', 'screen protector', '保護フィルム', 'ガラスフィルム', 'sticker', 'ステッカー', 'シール']],
    ['首饰吊坠/钥匙扣/带扣风险', ['ペンダント', 'pendant', 'チャーム', 'charm', 'ネックレス', 'necklace', 'ブレスレット', 'bracelet', 'ピアス', 'earring', 'イヤリング', 'アンクレット', 'anklet', 'ブローチ', 'brooch', 'ジュエリー', 'jewelry', 'キーホルダー', 'keychain', 'キーリング', 'key ring', 'バックル', 'buckle', 'clasp', 'チェーン', 'chain', 'カラビナ', 'carabiner', 'リング', 'ring', '指輪', 'ラインストーン', 'rhinestone', '吊坠', '项链', '手链', '手串', '耳环', '耳饰', '胸针', '首饰', '珠宝', '珠寶', '戒指', '钥匙扣', '鑰匙扣', '帶扣', '带扣', '链条', '链子']],
    ['玩具/人偶暂不支持风险', ['ぬいぐるみ', 'plush', 'doll', '人形', 'フィギュア', 'figure', 'toy figure', 'action figure', 'スクラップブック', 'stamp', 'スタンプ']],
    ['汽车/摩托配件暂不支持风险', ['自動車', '車用', '車載', '車内', '車の中', '汽车', '汽車', '车用', '车载', '车内', '汽车与摩托车', 'car ', 'car-', 'automotive', 'motorcycle', 'バイク', 'moto', 'tesla', 'トヨタ', 'toyota']],
    ['尖锐/工具/限制品风险', ['園林工具', '锄与耙', '除草', '雑草取り', 'ガーデニング', '钓鱼用品', '釣り', 'ルアー', 'ナイフ', 'knife', '刃', '包丁', 'cutter', 'カッター', 'razor', 'weapon', '針', 'needle', 'はさみ', 'scissors', 'saw', 'のこぎり', 'drill', 'ドリル', 'hammer', 'ハンマー', 'wrench', 'レンチ', 'screwdriver', 'ドライバー', 'plier', 'プライヤー', 'ペンチ', 'extension rod', 'drive', 'shaft', 'rod set', 'tool kit', 'manual tool', 'スナップボタン', '金属製スナップ']],
    ['大件/组装/家具风险', ['ソファ', 'sofa', 'テーブル', 'table', 'ベッド', 'bed', '家具', 'furniture', '椅子', 'chair', '棚', '大型', 'ラック', 'rack', 'シェルフ', 'shelf', '収納ラック', 'ワゴン', 'wagon', 'カート', 'cart', 'ペットベッド', 'pet bed', 'ゴミボックス', '30l', '45l', 'trash can', '置物架', '收纳架', '架子', '层架', '推车', '宠物床']],
    ['床品/枕芯/被套大件风险', ['ふとんカバー', '寝具', '枕の芯', '枕48x74', '布団カバー', 'ベッドシーツ', '掛け布団']],
    ['大件/金属健身器械风险', ['健身设备', 'フィットネス機械', 'パワーツイスター', 'twister bar', 'トレーニングボード', 'training board', 'トレーニング器具', 'fitness equipment', 'フラフープ', 'hula hoop', '腕相撲', 'リストトレーナー', '握力トレーナー', '前腕筋力']],
    ['大垫/地毯/不可压缩风险', ['ヨガマット', 'yoga mat', 'ラグ', 'rug', 'カーペット', 'carpet']],
    ['长杆/球拍/运动器械风险', ['ラケット', 'racket', 'racquet', 'テニス', 'tennis', 'バドミントン', 'badminton', 'バット', 'bat', 'ゴルフ', 'golf', 'club', 'ポール', 'pole', 'stick', '登山杖', '球拍', '长杆']],
    ['眼镜/镜片风险', ['メガネ', '眼鏡', '眼镜', 'サングラス', 'sunglasses', 'glasses', 'lens', 'lenses', 'レンズ', 'コンタクト', 'contact lens']],
    ['易碎玻璃/陶瓷/镜面风险', ['glass', 'ガラス', 'ceramic', '陶器', 'porcelain', '磁器', 'mirror', 'ミラー', '鏡', 'crystal', 'fragile', '割れ', '玻璃', '陶瓷', '镜子']],
    ['服装鞋靴高退货风险', ['ワンピース', 'dress', 'pants', 'ズボン', 'パンツ', 'サロペット', 'ワイドレッグ', 'shirt', 'シャツ', 'パーカー', 'フーディ', 'フード付き', 'スウェット', 'トップス', '長袖', 'ジップアップ', 'ヨガウェア', 'ブラジャー', 'ノンワイヤー', 'プッシュアップ', '靴', 'shoes']],
    ['大包/背包尺码容量风险', ['バックパック', 'backpack', 'リュック', 'パソコンバックパック']],
    ['香薰/驱虫/燃烧品监管风险', ['線香', 'お香', 'incense', 'インセンス', '香り', 'アロマ', '蚊よけ', '防虫剤', '害虫', '駆除', 'ゴキブリ', 'ネズミ', 'ダニ', '超音波', 'モスキート', '虫よけ']],
    ['车钥匙/汽车兼容配件风险', ['キーケース', 'リモートキー', 'key cover', 'car key', 'マツダ', 'mazda', 'cx-3', 'cx-5']],
    ['智能手表/儿童电子表风险', ['スマートウォッチ', 'smartwatch', 'smart watch', '歩数計', 'カメラ撮影', 'ビデオ録画']],
    ['大件软装/门帘窗帘风险', ['ドアカーテン', 'カーテン', 'curtain', 'メッシュカーテン']],
    ['植物/干花/花材风险', ['ドライフラワー', 'dry flower', 'プリザーブドフラワー', 'ソープフラワー', 'かすみ草', 'ブーケ', '花材', '植物']],
    ['危险形态/强磁/二手召回风险', ['粉末', 'powder', 'マグネット', 'magnet', '磁石', '磁気', '磁性', 'ドローン', 'drone', '中古', 'used', 'second hand', 'リコール', 'recall']],
    ['家电/插电设备风险', ['家电', '電器', '電気製品', '電化製品', 'appliance']]
  ];

  for (const [reason, keywords] of checks) {
    if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) return reason;
  }

  const weightKg = numberValue(findValue(record.product, ['weight_kg', 'weightKg']));
  const looseWeight = numberValue(findValue(record.product, ['weight']));
  const normalizedWeightKg = Number.isFinite(weightKg)
    ? weightKg
    : Number.isFinite(looseWeight) && looseWeight > 0 && looseWeight <= 20
      ? looseWeight
      : NaN;
  if (Number.isFinite(normalizedWeightKg) && normalizedWeightKg > 2) return '超过 2kg 小卖家重量风险';

  const dimensions = [
    numberValue(findValue(record.product, ['length', 'length_cm', 'lengthCm'])),
    numberValue(findValue(record.product, ['width', 'width_cm', 'widthCm'])),
    numberValue(findValue(record.product, ['height', 'height_cm', 'heightCm']))
  ].filter(Number.isFinite);
  if (dimensions.length && Math.max(...dimensions) > 40 && !isRollableFoldable(text)) return '长边超过 40cm 小卖家尺寸风险';

  return '';
}

function isRollableFoldable(text) {
  return matchesAny(text, [
    '折りたたみ', '折り畳み', '折りりたたみ', '折叠', '折疊', 'foldable', 'folding',
    'ロール', '巻き', '卷', '捲', 'rollable', 'rolled',
    '圧縮', '压缩', '壓縮', 'compressible', 'compression',
    '布製', 'キャンバス', 'ナイロン', 'シリコン', 'ゴム製', '布', '帆布', '硅胶', '橡胶',
    'マウスパッド', 'mouse pad', 'mousepad', 'デスクマット', 'desk mat'
  ]);
}

function softRiskFlags(text, categoryTextValue) {
  const flags = [];
  if (matchesAny(text, ['充電', '充電式', 'rechargeable', 'usb', 'led', 'ライト', 'lamp', 'ソーラー', 'solar', 'センサーライト', '扇風機'])) {
    flags.push('带电/灯具/USB 类需复核日本合规和物流');
  }
  if (matchesAny(text, ['キッチン', 'kitchen', '厨房', '烘焙', 'baking', '泡立て', 'whisk', '調理器具', 'cooking utensil'])) {
    flags.push('厨房或入口接触场景需复核材质与合规');
  }
  if (matchesAny(text, ['レインコート', 'レインウェア', 'レインスーツ', '雨衣', 'ワンピース', 'dress', 'pants', 'ズボン', 'パンツ', 'shirt', 'シャツ', 'パーカー', 'トップス', '長袖', '靴', 'shoes', 'ソックス', 'socks', '靴下', 'アームカバー', '帽子', 'キャップ', 'ハット', 'ウィッグ', 'wig', '前髪', 'ヘアピース', '白髪カバー', '腕時計', 'watch', 'wristwatch', 'ベルト', 'belt'])) {
    flags.push('穿戴尺码与退货风险需复核');
  }
  if (matchesAny(text, ['ブランケット', '毛布', 'blanket', 'クッション', 'pillow', '枕', 'シーツ', 'バスシーツ', 'タオル', '収納ボックス', '収納バッグ'])) {
    flags.push('软装尺寸重量需复核，可压缩才考虑');
  }
  if (matchesAny(text, ['スマホ', 'スマートフォン', '携帯電話', 'phone accessory', 'phone accessories', 'mobile phone', 'android phones', 'samsung galaxy', 'macbook', 'laptop', 'adapter', 'usb type c', 'usb-c adapter', 'type-c adapter', 'hdmi', 'converter'])) {
    flags.push('数码兼容/接口规格需复核，避开手机壳贴膜贴纸');
  }
  if (matchesAny(text, ['notebook', 'ノート', '紙品', '現金ホールダー', 'カードホルダー'])) {
    flags.push('纸品/收纳属性需复核平台支持度和利润');
  }
  if (matchesAny(text, ['財布', 'ウォレット', 'wallet', 'カードケース', 'カードホルダー'])) {
    flags.push('钱包/卡包材质、品牌词和五金件需复核');
  }
  if (matchesAny(text, ['ショルダーバッグ', 'チェストバッグ', 'ウエストバッグ', 'トートバッグ', 'メッセンジャーバッグ', 'crossbody', 'shoulder bag'])) {
    flags.push('包袋容量和五金配件需复核，优先轻薄软包');
  }
  if (matchesAny(text, ['ノンスリップ', 'すべり止めテープ', '滑り止めテープ', '防滑テープ', 'anti slip tape', 'non slip tape'])) {
    flags.push('五金胶带/施工耗材属性需复核');
  }
  if (matchesAny(text, ['アンブレラ', '傘', 'umbrella'])) {
    flags.push('雨具需复核折叠后长度和重量');
  }
  if (matchesAny(text, ['キャビネット', 'シューズラック', '収納ラック', 'ラック', '棚', 'organizer']) || matchesAny(categoryTextValue, ['hardware', 'tools', '工具'])) {
    flags.push('尺寸或五金类目需复核');
  }
  return flags;
}

function isOldProduct(record, dedupe) {
  if (!dedupe || dedupe.source !== 'firestore') return false;
  if (record.product_id && dedupe.oldProductIds.has(String(record.product_id))) return true;
  const url = normalizeUrl(record.product_url);
  return Boolean(url && dedupe.oldProductUrls.has(url));
}

function scoreRecord(record) {
  let score = 50;
  const reasons = [];
  const flags = [];
  const text = searchableText(record);
  const productText = productSearchableText(record);
  const categoryTextValue = `${record.product_category} ${record.shop_category}`.toLowerCase();

  if (record.product_7d_sold_count >= 1) add(10, '商品近7天有真实成交');
  if (record.product_7d_sold_count >= 5) add(4, '商品近7天销量达到 5+');
  if (record.product_7d_sold_count >= 20) add(4, '商品近7天销量达到 20+');
  if (record.product_7d_sold_count >= 100) add(-4, '销量较高，后续要检查竞争是否过热');

  if (record.shop_day7_sold_count >= 1) add(6, '店铺近7天有成交');
  if (record.shop_day7_sold_count >= 30) add(4, '店铺近期仍在动销');
  if (record.shop_total_sales_jpy >= 10000 && record.shop_total_sales_jpy <= 80000) add(8, '店铺总销售额处于目标区间');

  if (matchesAny(categoryTextValue, ['居家日用', 'household', 'home', 'home textile', 'fabric', 'textile', '布', 'computer', 'office', 'desk'])) {
    add(12, '类目符合轻小日用/布艺/办公偏好');
  } else if (matchesAny(categoryTextValue, ['pet', 'ペット', 'fashion accessories', 'アクセサリー', 'diy', '箱包', 'バッグ'])) {
    add(8, '类目可做但需复核');
  } else if (matchesAny(categoryTextValue, ['sports', 'outdoor', 'スポーツ', 'アウトドア'])) {
    add(4, '运动户外只保留轻小可压缩配件');
    flags.push('运动户外类目需复核');
  } else if (matchesAny(categoryTextValue, ['hardware', 'tools', 'tool', '工具'])) {
    add(-6, '五金工具类目谨慎，只保留非尖锐轻小耗材');
    flags.push('五金工具类目需复核');
  } else if (matchesAny(categoryTextValue, ['beauty', 'personal care', 'mother', 'baby', 'toy', 'toys', 'furniture', 'clothing'])) {
    add(-8, '类目属于谨慎范围');
    flags.push('谨慎类目');
  }

  if (isRollableFoldable(text)) add(8, '可折叠/可卷/可压缩，物流形态有机会');
  if (matchesAny(text, ['セット', 'set', 'pack', 'pcs', '個入', '枚入', '本入'])) add(6, '有组合装/多件装机会');
  if (matchesAny(text, ['タオル', 'towel', 'ゴム手袋', '手袋', '圧縮袋', '収納袋', '扇子', 'アンブレラ', '傘', 'レイン', 'カバー'])) {
    add(6, '轻小日用/软材质/季节需求可复核');
  }
  if (matchesAny(text, ['ソックス', 'socks', '靴下', '帽子', 'キャップ', 'ハット', 'アームカバー', 'バッグ', 'bag', 'ポーチ', 'pouch'])) {
    add(3, '轻小穿戴/软包类，复核尺码和退货后可考虑');
  }
  if (matchesAny(text, ['カバー', 'cover', 'ケース', 'case', 'ホルダー', 'holder', 'クリップ', 'clip', 'フック', 'hook', 'パッド', 'pad', 'シート', 'sheet', 'strap', 'band', 'オーガナイザー', 'organizer'])) {
    add(8, '偏小件配件，适合小卖家切长尾');
  }
  if (matchesAny(text, ['camp', 'キャンプ', '車', 'car', 'pet', 'ペット', 'desk', 'デスク', '収納', 'storage', 'cleaning', '掃除', 'fitness', 'トレーニング'])) {
    add(5, '有明确场景词，方便做内容角度');
  }

  if (!record.product_name) {
    add(-20, '缺商品名，必须人工补全');
    flags.push('缺商品名');
  }
  if (matchesAny(productText, ['iphone', 'ipad'])) {
    flags.push('兼容品牌词，需确认无 logo/IP 侵权');
  }
  for (const flag of softRiskFlags(productText, categoryTextValue)) {
    if (!flags.includes(flag)) flags.push(flag);
  }

  const demandScene = demandSceneFor(text, categoryTextValue);
  const smallSellerOpportunity = opportunityFor(text, categoryTextValue);
  const suggestedAction = score >= 78
    ? '优先人工复核图片/尺寸/货源'
    : score >= 65
      ? '进入备选池，复核风险后再找货'
      : '暂缓，除非有明显货源优势';

  return {
    score,
    candidate: record.product_name || record.product_id || '(未知商品)',
    product_id: record.product_id,
    shop_name: record.shop_name,
    seller_id: record.seller_id,
    product_category: record.product_category,
    shop_category: record.shop_category,
    product_price: record.product_price,
    product_7d_sold_count: record.product_7d_sold_count,
    product_sales_amount: record.product_sales_amount,
    shop_total_sales_jpy: record.shop_total_sales_jpy,
    shop_day7_sold_count: record.shop_day7_sold_count,
    demand_scene: demandScene,
    small_seller_opportunity: smallSellerOpportunity,
    risk_flags: flags.join('；'),
    suggested_action: suggestedAction,
    score_reasons: reasons.join('；'),
    product_url: record.product_url,
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
    product_url: record.product_url,
    shop_url: record.shop_url
  };
}

function demandSceneFor(text, categoryTextValue) {
  if (matchesAny(text, ['pet', 'ペット', '犬', '猫'])) return '宠物日常消耗/护理/收纳场景';
  if (matchesAny(text, ['camp', 'キャンプ', 'outdoor', 'アウトドア'])) return '露营/户外便携场景';
  if (matchesAny(text, ['car', '車', 'tesla'])) return '车内配件/改装小配件场景';
  if (matchesAny(text, ['desk', 'デスク', 'office', 'パソコン', 'pc'])) return '桌面办公/电脑周边场景';
  if (matchesAny(text, ['収納', 'storage', 'organizer'])) return '家庭收纳整理场景';
  if (matchesAny(text, ['掃除', 'cleaning', 'ブラシ'])) return '清洁维护场景';
  if (matchesAny(text, ['fitness', 'training', 'トレーニング', 'yoga'])) return '运动训练/恢复场景';
  if (matchesAny(categoryTextValue, ['hardware', 'tools', '工具'])) return '轻小耗材/维修配件场景';
  return '需求场景待人工确认';
}

function opportunityFor(text, categoryTextValue) {
  const opportunities = [];
  if (matchesAny(text, ['セット', 'set', 'pack', 'pcs', '個入', '枚入', '本入'])) opportunities.push('可测多件装/组合装');
  if (matchesAny(text, ['カバー', 'cover', 'ケース', 'case', 'ホルダー', 'holder', 'クリップ', 'clip', 'フック', 'hook'])) opportunities.push('小配件长尾词机会');
  if (matchesAny(text, ['pet', 'ペット', 'camp', 'キャンプ', 'car', '車', 'desk', 'デスク'])) opportunities.push('可做场景化标题和短视频开头');
  if (matchesAny(categoryTextValue, ['sports', 'outdoor', 'fabric', 'textile'])) opportunities.push('类目贴近小卖家偏好');
  return opportunities.length ? opportunities.join('；') : '需人工判断是否能避开大卖家正面竞争';
}

function productUrl(product, productId) {
  const explicit = stringValue(findValue(product, ['product_url', 'productUrl', 'tk_product_url', 'tkProductUrl', 'tiktok_product_url']));
  if (explicit) return explicit;
  const url = stringValue(findValue(product, ['url', 'detail_url', 'detailUrl']));
  if (/tiktok\\.com/i.test(url)) return url;
  return productId ? `https://www.tiktok.com/view/product/${productId}` : '';
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
    stringValue(findValue(record.product, ['desc', 'description', 'subtitle']))
  ].join(' ').toLowerCase();
}

function productSearchableText(record) {
  return [
    record.product_name,
    record.product_price,
    stringValue(findValue(record.product, ['desc', 'description', 'subtitle']))
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
  if (!text) return NaN;
  const multiplier = text.includes('万') ? 10000 : text.toLowerCase().includes('k') ? 1000 : 1;
  const number = Number.parseFloat(text.replace(/[,，￥¥円日元$\\s]/g, '').replace(/万|k/gi, ''));
  return Number.isFinite(number) ? number * multiplier : NaN;
}

function stringValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ');
  return String(value).trim();
}

function categoryText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' / ');
  return stringValue(value);
}

function candidateHeaders() {
  return [
    '账号',
    '选品分',
    '商品名称',
    '店铺名',
    '商品类目',
    '店铺类目',
    '商品价格',
    '商品近7天销量',
    '店铺总销售额（日元）',
    '店铺近7天销量',
    '需求场景与机会',
    '选品判断',
    '商品链接',
    'FastMoss 链接',
    '图片链接',
    '是否旧商品',
    '是否计入本次'
  ];
}

function rejectHeaders() {
  return [
    '账号',
    '拒绝原因',
    '商品名称',
    '店铺名',
    '商品类目',
    '店铺类目',
    '商品近7天销量',
    '店铺总销售额（日元）',
    '商品链接',
    '店铺链接',
    '是否旧商品',
    '是否计入本次'
  ];
}

function formatCandidateRow(record, targetAccount) {
  return {
    '账号': targetAccount,
    '选品分': record.score,
    '商品名称': record.candidate,
    '店铺名': record.shop_name,
    '商品类目': record.product_category,
    '店铺类目': record.shop_category,
    '商品价格': record.product_price,
    '商品近7天销量': record.product_7d_sold_count,
    '店铺总销售额（日元）': record.shop_total_sales_jpy,
    '店铺近7天销量': record.shop_day7_sold_count,
    '需求场景与机会': [record.demand_scene, record.small_seller_opportunity].filter(Boolean).join('；'),
    '选品判断': buildSelectionJudgementText(record),
    '商品链接': record.product_url,
    'FastMoss 链接': record.shop_url,
    '图片链接': record.image_url,
    '是否旧商品': '否',
    '是否计入本次': '是'
  };
}

function formatRejectRow(record, targetAccount) {
  return {
    '账号': targetAccount,
    '拒绝原因': record.reason,
    '商品名称': record.candidate,
    '店铺名': record.shop_name,
    '商品类目': record.product_category,
    '店铺类目': record.shop_category,
    '商品近7天销量': record.product_7d_sold_count,
    '店铺总销售额（日元）': record.shop_total_sales_jpy,
    '商品链接': record.product_url,
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
