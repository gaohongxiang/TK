#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const notifyScript = path.join(scriptDir, 'notify-human-verification.mjs');

const COLLECTION_RECORD_HEADERS = [
  '账号',
  '选品分',
  '商品名称',
  '店铺名',
  '商品价格',
  '商品近7天销量',
  '采集时间',
  '采集状态',
  '选品判断',
  '商品链接',
  'FastMoss 链接',
  '出海匠链接',
  '店铺链接'
];

const DEFAULT_CANDIDATE_FILES = [
  'final_collection_candidates.json',
  'selection_candidates.json'
];

const VALID_COLLECT_STATUSES = new Set(['已采集', '采集失败']);
const DEFAULT_CDP_ENDPOINT = 'http://127.0.0.1:9222';

const CLICKABLE_SELECTOR = [
  'button',
  '[role="button"]',
  'a',
  'input[type="button"]',
  'input[type="submit"]',
  '[class*="button" i]',
  '[class*="btn" i]',
  '[class*="collect" i]',
  '[class*="dianxiaomi" i]',
  '[class*="dxm" i]'
].join(',');

const START_BUTTON_PATTERNS = [
  /^\s*(开始采集|开始采集商品|立即采集|一键采集|采集到店小秘)\s*$/i,
  /店小秘.{0,12}(开始|立即|一键)?采集/i
];

const SUCCESS_PATTERNS = [
  /采集成功/i,
  /已成功采集/i,
  /前往采集箱/i,
  /采集箱/i,
  /collect(?:ion)?\s+success/i,
  /successfully\s+collected/i
];

const DUPLICATE_PATTERNS = [
  /已有采集记录/i,
  /是否继续采集/i,
  /重复采集/i,
  /已存在/i,
  /already\s+(?:collected|exists)/i
];

const FAILURE_PATTERNS = [
  /采集失败/i,
  /采集异常/i,
  /不支持采集/i,
  /无法采集/i,
  /需使用插件采集/i,
  /登录后.*采集/i,
  /collect(?:ion)?\s+fail/i
];

const VERIFICATION_PATTERNS = [
  /verify\s+to\s+continue/i,
  /drag\s+the\s+puzzle/i,
  /security\s+check/i,
  /captcha/i,
  /human\s+verification/i,
  /complete\s+the\s+verification/i,
  /安全验证/i,
  /人机验证/i,
  /滑块/i,
  /拖动.*拼图/i,
  /请完成验证/i,
  /验证通过/i
];

class ExitWithCode extends Error {
  constructor(message, code = 1, meta = {}) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const runDir = resolveRunDir(args);
  const account = normalizeText(args.account || process.env.TK_COLLECTION_ACCOUNT || await accountFromRun(runDir));
  if (!account) throw new ExitWithCode('缺少目标账号：请使用 --account <账号名>，例如 --account NOMA。', 1);

  const runManifest = await readJson(path.join(runDir, 'run_manifest.json'), {});
  const targetSuccesses = toInteger(args.targetSuccesses || args['target-successes'] || runManifest.targetCount, 20);
  const minCandidatePool = toInteger(args.minCandidatePool || args['min-candidate-pool'], targetSuccesses >= 20 ? 40 : targetSuccesses);
  const stateFile = path.join(runDir, 'rpa_state.json');
  const eventsFile = path.join(runDir, 'rpa_events.jsonl');
  const attemptsFile = path.join(runDir, 'collection_attempts.json');
  const recordsFile = path.join(runDir, 'collection_records.csv');
  const dryRun = Boolean(args.dryRun || args['dry-run']);
  const rebuildRecordsOnly = Boolean(args.rebuildRecords || args['rebuild-records']);

  const candidates = await loadCandidatePool(runDir, args);
  const attempts = normalizeAttempts(await readJson(attemptsFile, []), account);
  const summary = summarizeAttempts(attempts);
  const poolWarning = candidates.length < minCandidatePool
    ? `候选池只有 ${candidates.length} 个，建议成功目标 ${targetSuccesses} 时准备至少 ${minCandidatePool} 个。`
    : '';

  if (!dryRun) {
    await appendEvent(eventsFile, {
      event: 'runner_started',
      runDir,
      account,
      targetSuccesses,
      candidateCount: candidates.length,
      attemptedCount: summary.attemptedCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      ...(poolWarning ? { warning: poolWarning } : {})
    });
    await writeState(stateFile, {
      status: summary.successCount >= targetSuccesses ? 'complete' : 'running',
      stage: rebuildRecordsOnly ? 'rebuilding_records' : 'loading_candidates',
      account,
      runDir,
      targetSuccesses,
      candidateCount: candidates.length,
      attemptedCount: summary.attemptedCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      recoveryPoint: null,
      candidatePoolWarning: poolWarning || null
    });
  }

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      runDir,
      account,
      targetSuccesses,
      candidateCount: candidates.length,
      attemptedCount: summary.attemptedCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      candidatePoolWarning: poolWarning || null,
      nextProductId: selectNextCandidate({ runDir, candidates, attempts, args })?.productId || null
    }, null, 2));
    return;
  }

  if (rebuildRecordsOnly) {
    await writeAttemptsAndRecords({ attemptsFile, recordsFile, attempts });
    await writeState(stateFile, {
      status: summary.successCount >= targetSuccesses ? 'complete' : 'records_rebuilt',
      stage: 'records_rebuilt',
      account,
      runDir,
      targetSuccesses,
      candidateCount: candidates.length,
      attemptedCount: summary.attemptedCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      recoveryPoint: null,
      candidatePoolWarning: poolWarning || null
    });
    await appendEvent(eventsFile, {
      event: 'records_rebuilt',
      recordsFile,
      attemptsFile,
      attemptedCount: summary.attemptedCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount
    });
    console.log(JSON.stringify({
      ok: true,
      rebuilt: true,
      recordsFile,
      attemptsFile,
      ...summary
    }, null, 2));
    return;
  }

  const browserSession = await connectBrowser(args, stateFile, eventsFile, {
    runDir,
    account,
    targetSuccesses,
    candidateCount: candidates.length,
    attempts
  });

  const limit = toInteger(args.limit, Number.POSITIVE_INFINITY);
  const verificationMode = normalizeVerificationMode(args.verificationMode || args['verification-mode'] || 'wait-fail');
  const verificationTimeoutMs = toInteger(args.verificationTimeoutMs || args['verification-timeout-ms'], 5 * 60 * 1000);
  const resultTimeoutMs = toInteger(args.resultTimeoutMs || args['result-timeout-ms'], 60 * 1000);
  const pluginTimeoutMs = toInteger(args.pluginTimeoutMs || args['plugin-timeout-ms'], 45 * 1000);
  const minDelayMs = toInteger(args.minDelayMs || args['min-delay-ms'], 20 * 1000);
  const maxDelayMs = Math.max(minDelayMs, toInteger(args.maxDelayMs || args['max-delay-ms'], 60 * 1000));
  const closePages = args.closePages !== false && args['close-pages'] !== false;
  const failMissingPlugin = args.failMissingPlugin !== false && args['fail-missing-plugin'] !== false;

  let currentAttempts = attempts;
  let currentSummary = summarizeAttempts(currentAttempts);
  let processedThisRun = 0;
  let slowMode = false;

  while (currentSummary.successCount < targetSuccesses && processedThisRun < limit) {
    const next = selectNextCandidate({ runDir, candidates, attempts: currentAttempts, args });
    if (!next) {
      await appendEvent(eventsFile, {
        event: 'candidate_pool_exhausted',
        targetSuccesses,
        ...currentSummary
      });
      await writeState(stateFile, {
        status: 'candidate_pool_exhausted',
        stage: 'candidate_pool_exhausted',
        account,
        runDir,
        targetSuccesses,
        candidateCount: candidates.length,
        ...currentSummary,
        recoveryPoint: null,
        candidatePoolWarning: poolWarning || null
      });
      throw new ExitWithCode('候选池已耗尽，成功采集数量还未达到目标。请补充 40-60 个合格候选后继续。', 2, currentSummary);
    }

    if (processedThisRun > 0) {
      const waitMs = slowMode ? Math.max(maxDelayMs, 60 * 1000) : randomInteger(minDelayMs, maxDelayMs);
      await appendEvent(eventsFile, {
        event: 'natural_interval_wait',
        waitMs,
        nextProductId: next.productId
      });
      await delay(waitMs);
    }

    const result = await processCandidate({
      browserSession,
      runDir,
      account,
      candidate: next.candidate,
      candidateIndex: next.index,
      productId: next.productId,
      stateFile,
      eventsFile,
      verificationMode,
      verificationTimeoutMs,
      resultTimeoutMs,
      pluginTimeoutMs,
      closePages,
      failMissingPlugin,
      targetSuccesses,
      candidateCount: candidates.length,
      currentSummary,
      poolWarning
    });

    if (result.verificationTriggered) slowMode = true;
    currentAttempts = upsertAttempt(currentAttempts, result.attempt);
    await writeAttemptsAndRecords({ attemptsFile, recordsFile, attempts: currentAttempts });
    currentSummary = summarizeAttempts(currentAttempts);
    processedThisRun += 1;

    await writeState(stateFile, {
      status: currentSummary.successCount >= targetSuccesses ? 'complete' : 'running',
      stage: currentSummary.successCount >= targetSuccesses ? 'complete' : 'idle',
      account,
      runDir,
      targetSuccesses,
      candidateCount: candidates.length,
      ...currentSummary,
      currentProductId: null,
      recoveryPoint: null,
      candidatePoolWarning: poolWarning || null,
      lastResult: {
        productId: result.productId,
        collectStatus: result.attempt['采集状态'],
        finishedAt: result.attempt.finishedAt || result.attempt['采集时间']
      }
    });
  }

  currentSummary = summarizeAttempts(currentAttempts);
  const completed = currentSummary.successCount >= targetSuccesses;
  await appendEvent(eventsFile, {
    event: completed ? 'runner_completed' : 'runner_limited',
    targetSuccesses,
    processedThisRun,
    ...currentSummary
  });
  await writeState(stateFile, {
    status: completed ? 'complete' : 'limited',
    stage: completed ? 'complete' : 'limited',
    account,
    runDir,
    targetSuccesses,
    candidateCount: candidates.length,
    ...currentSummary,
    recoveryPoint: null,
    candidatePoolWarning: poolWarning || null
  });

  console.log(JSON.stringify({
    ok: completed,
    runDir,
    targetSuccesses,
    processedThisRun,
    recordsFile,
    attemptsFile,
    stateFile,
    eventsFile,
    ...currentSummary,
    candidatePoolWarning: poolWarning || null
  }, null, 2));

  if (!completed) process.exitCode = 2;
}

async function processCandidate(options) {
  const {
    browserSession,
    runDir,
    account,
    candidate,
    candidateIndex,
    productId,
    stateFile,
    eventsFile,
    verificationMode,
    verificationTimeoutMs,
    resultTimeoutMs,
    pluginTimeoutMs,
    closePages,
    failMissingPlugin,
    targetSuccesses,
    candidateCount,
    currentSummary,
    poolWarning
  } = options;
  const productUrl = normalizeTkProductUrl(getCandidateValue(candidate, ['商品链接', '核心 TK 链接', 'product_url', 'tk_product_url', 'tiktokOfficialUrl', 'tiktok_official_url', '链接']), productId);
  const startedAt = new Date().toISOString();
  let page = null;
  let verificationTriggered = false;

  if (!productUrl) {
    const reason = '采集失败：候选商品缺少真实 TikTok 商品链接，未进入店小秘插件采集。';
    return {
      productId,
      verificationTriggered,
      attempt: buildAttempt({ candidate, account, status: '采集失败', reason, startedAt, stage: 'missing_tiktok_url' })
    };
  }

  await writeState(stateFile, {
    status: 'running',
    stage: 'opening_tiktok',
    account,
    runDir,
    targetSuccesses,
    candidateCount,
    ...currentSummary,
    currentProductId: productId,
    recoveryPoint: {
      candidateIndex,
      productId,
      productUrl,
      stage: 'opening_tiktok',
      startedAt
    },
    candidatePoolWarning: poolWarning || null
  });
  await appendEvent(eventsFile, {
    event: 'product_started',
    productId,
    candidateIndex,
    productUrl,
    productName: trimForLog(getCandidateValue(candidate, ['商品名称', 'productName', 'title']), 120)
  });

  try {
    page = await browserSession.context.newPage();
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: toInteger(options.navigationTimeoutMs, 60 * 1000) });
    await waitForPageSettle(page, 2500);

    const verificationBeforePlugin = await handleVerificationIfNeeded({
      page,
      runDir,
      account,
      candidate,
      productId,
      productUrl,
      stateFile,
      eventsFile,
      stage: 'tiktok-product-page',
      verificationMode,
      verificationTimeoutMs,
      targetSuccesses,
      candidateCount,
      currentSummary,
      poolWarning
    });
    verificationTriggered = verificationTriggered || verificationBeforePlugin.triggered;
    if (verificationBeforePlugin.failedAttempt) {
      if (closePages) await safeClosePage(page);
      return { productId, verificationTriggered, attempt: verificationBeforePlugin.failedAttempt };
    }
    if (verificationBeforePlugin.paused) throw new ExitWithCode('TikTok 商品页触发平台人工确认，已保存恢复点并暂停当前商品。', 3, { productId });

    await writeState(stateFile, {
      status: 'running',
      stage: 'checking_dxm_button',
      account,
      runDir,
      targetSuccesses,
      candidateCount,
      ...currentSummary,
      currentProductId: productId,
      recoveryPoint: {
        candidateIndex,
        productId,
        productUrl,
        stage: 'checking_dxm_button',
        startedAt
      },
      candidatePoolWarning: poolWarning || null
    });

    const startButton = await waitForStartButton(page, pluginTimeoutMs);
    if (!startButton) {
      const reason = failMissingPlugin
        ? '采集失败：TikTok 商品页已打开，但未找到店小秘“开始采集”按钮，未确认插件采集成功。'
        : '采集失败：TikTok 商品页已打开，但本次未点击店小秘插件。';
      await appendEvent(eventsFile, { event: 'dxm_button_missing', productId, reason });
      if (closePages) await safeClosePage(page);
      return {
        productId,
        verificationTriggered,
        attempt: buildAttempt({ candidate, account, status: '采集失败', reason, startedAt, stage: 'dxm_button_missing' })
      };
    }

    await writeState(stateFile, {
      status: 'running',
      stage: 'clicking_dxm_start',
      account,
      runDir,
      targetSuccesses,
      candidateCount,
      ...currentSummary,
      currentProductId: productId,
      recoveryPoint: {
        candidateIndex,
        productId,
        productUrl,
        stage: 'clicking_dxm_start',
        startedAt
      },
      candidatePoolWarning: poolWarning || null
    });
    await appendEvent(eventsFile, { event: 'dxm_start_button_found', productId });

    await startButton.locator.click({ timeout: 15 * 1000 });
    await appendEvent(eventsFile, { event: 'dxm_start_clicked', productId });

    const result = await waitForCollectionResult({
      page,
      runDir,
      account,
      candidate,
      productId,
      productUrl,
      stateFile,
      eventsFile,
      stage: 'plugin-collection',
      verificationMode,
      verificationTimeoutMs,
      resultTimeoutMs,
      targetSuccesses,
      candidateCount,
      currentSummary,
      poolWarning
    });
    verificationTriggered = verificationTriggered || result.verificationTriggered;
    if (result.paused) throw new ExitWithCode('店小秘采集阶段触发平台人工确认，已保存恢复点并暂停当前商品。', 3, { productId });

    if (closePages) await safeClosePage(page);
    return {
      productId,
      verificationTriggered,
      attempt: buildAttempt({
        candidate,
        account,
        status: result.status,
        reason: result.reason,
        startedAt,
        stage: result.stage || 'plugin-collection',
        resultKind: result.resultKind
      })
    };
  } catch (error) {
    if (error instanceof ExitWithCode) throw error;
    const reason = `采集失败：RPA 执行异常，未确认店小秘采集成功。${trimForLog(error.message, 160)}`;
    await appendEvent(eventsFile, { event: 'product_error', productId, error: trimForLog(error.message, 200) });
    if (page && closePages) await safeClosePage(page);
    return {
      productId,
      verificationTriggered,
      attempt: buildAttempt({ candidate, account, status: '采集失败', reason, startedAt, stage: 'rpa_error' })
    };
  }
}

async function handleVerificationIfNeeded(options) {
  const {
    page,
    runDir,
    account,
    candidate,
    productId,
    productUrl,
    stateFile,
    eventsFile,
    stage,
    verificationMode,
    verificationTimeoutMs,
    targetSuccesses,
    candidateCount,
    currentSummary,
    poolWarning
  } = options;
  const initial = await inspectPage(page);
  if (!initial.verification) return { triggered: false };

  await writeVerificationBlocked({
    runDir,
    account,
    candidate,
    productId,
    productUrl,
    currentUrl: page.url(),
    stage,
    reason: initial.verificationReason || '页面触发平台人工确认。',
    stateFile,
    eventsFile,
    targetSuccesses,
    candidateCount,
    currentSummary,
    poolWarning
  });

  const resumed = await waitForVerificationRecovery(page, verificationTimeoutMs);
  if (resumed) {
    await writePageConfirmation(runDir, {
      status: 'resumed',
      platform: 'tiktok',
      stage,
      productId,
      productName: trimForLog(getCandidateValue(candidate, ['商品名称', 'productName', 'title']), 160),
      url: productUrl,
      currentUrl: page.url(),
      account,
      updatedAt: new Date().toISOString()
    });
    await appendEvent(eventsFile, { event: 'verification_resumed', productId, stage });
    return { triggered: true, resumed: true };
  }

  if (verificationMode === 'pause') {
    await appendEvent(eventsFile, {
      event: 'verification_paused',
      productId,
      stage,
      timeoutMs: verificationTimeoutMs
    });
    return { triggered: true, paused: true };
  }

  const reason = '采集失败：TikTok 商品页触发平台人工确认，等待超时仍未恢复，未确认店小秘采集成功。';
  await appendEvent(eventsFile, {
    event: 'verification_timeout_failed',
    productId,
    stage,
    timeoutMs: verificationTimeoutMs
  });
  return {
    triggered: true,
    failedAttempt: buildAttempt({ candidate, account, status: '采集失败', reason, startedAt: new Date().toISOString(), stage: 'verification_timeout' })
  };
}

async function waitForCollectionResult(options) {
  const {
    page,
    runDir,
    account,
    candidate,
    productId,
    productUrl,
    stateFile,
    eventsFile,
    stage,
    verificationMode,
    verificationTimeoutMs,
    resultTimeoutMs,
    targetSuccesses,
    candidateCount,
    currentSummary,
    poolWarning
  } = options;
  const started = Date.now();
  let verificationTriggered = false;
  while (Date.now() - started <= resultTimeoutMs) {
    await waitForPageSettle(page, 1800);
    const inspected = await inspectPage(page);

    if (inspected.verification) {
      const verification = await handleVerificationIfNeeded({
        page,
        runDir,
        account,
        candidate,
        productId,
        productUrl,
        stateFile,
        eventsFile,
        stage,
        verificationMode,
        verificationTimeoutMs,
        targetSuccesses,
        candidateCount,
        currentSummary,
        poolWarning
      });
      verificationTriggered = true;
      if (verification.failedAttempt) {
        return {
          verificationTriggered,
          status: verification.failedAttempt['采集状态'],
          reason: verification.failedAttempt['选品判断'],
          stage: 'verification_timeout',
          resultKind: 'verification_failed'
        };
      }
      if (verification.paused) return { verificationTriggered, paused: true };
      continue;
    }

    if (inspected.duplicate) {
      await clickDuplicateCancel(page);
      const reason = `${baseJudgement(candidate)}；店小秘提示已有采集记录，已取消重复采集，本次按已采集记录。`;
      await appendEvent(eventsFile, { event: 'dxm_duplicate_cancelled', productId });
      return {
        verificationTriggered,
        status: '已采集',
        reason,
        stage: 'duplicate_cancelled',
        resultKind: 'duplicate'
      };
    }

    if (inspected.success) {
      const reason = `${baseJudgement(candidate)}；店小秘插件显示采集成功。`;
      await appendEvent(eventsFile, { event: 'dxm_collect_success', productId });
      return {
        verificationTriggered,
        status: '已采集',
        reason,
        stage: 'collect_success',
        resultKind: 'success'
      };
    }

    if (inspected.failure) {
      const reason = `${baseJudgement(candidate)}；采集失败：店小秘插件返回失败或不支持采集，未确认采集成功。`;
      await appendEvent(eventsFile, {
        event: 'dxm_collect_failure_detected',
        productId,
        reason: inspected.failureReason || ''
      });
      return {
        verificationTriggered,
        status: '采集失败',
        reason,
        stage: 'plugin_failure',
        resultKind: 'plugin_failure'
      };
    }
  }

  const reason = `${baseJudgement(candidate)}；采集失败：已点击店小秘“开始采集”，但等待超时后仍未看到采集成功、重复采集或明确失败提示。`;
  await appendEvent(eventsFile, {
    event: 'dxm_result_timeout',
    productId,
    timeoutMs: resultTimeoutMs
  });
  return {
    verificationTriggered,
    status: '采集失败',
    reason,
    stage: 'result_timeout',
    resultKind: 'timeout'
  };
}

async function writeVerificationBlocked(options) {
  const {
    runDir,
    account,
    candidate,
    productId,
    productUrl,
    currentUrl,
    stage,
    reason,
    stateFile,
    eventsFile,
    targetSuccesses,
    candidateCount,
    currentSummary,
    poolWarning
  } = options;
  const now = new Date().toISOString();
  await writePageConfirmation(runDir, {
    status: 'verification_blocked',
    platform: 'tiktok',
    stage,
    productId,
    productName: trimForLog(getCandidateValue(candidate, ['商品名称', 'productName', 'title']), 160),
    url: productUrl,
    currentUrl,
    account,
    reason: trimForLog(reason, 160),
    blockedAt: now,
    updatedAt: now
  });
  await notifyHumanVerification({ runDir, platform: 'tiktok', stage, productId, message: reason });
  await appendEvent(eventsFile, {
    event: 'verification_blocked',
    productId,
    stage,
    reason: trimForLog(reason, 160)
  });
  await writeState(stateFile, {
    status: 'verification_blocked',
    stage,
    account,
    runDir,
    targetSuccesses,
    candidateCount,
    ...currentSummary,
    currentProductId: productId,
    recoveryPoint: {
      productId,
      productUrl,
      stage,
      blockedAt: now
    },
    candidatePoolWarning: poolWarning || null
  });
}

async function waitForVerificationRecovery(page, timeoutMs) {
  const started = Date.now();
  do {
    await delay(Math.min(15 * 1000, Math.max(2500, timeoutMs || 2500)));
    const inspected = await inspectPage(page);
    if (!inspected.verification) return true;
  } while (Date.now() - started < timeoutMs);
  return false;
}

async function waitForStartButton(page, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const inspected = await inspectPage(page);
    if (inspected.verification) return null;
    const found = await findVisibleTextLocator(page, START_BUTTON_PATTERNS);
    if (found) return found;
    await delay(1500);
  }
  return null;
}

async function findVisibleTextLocator(page, patterns, selector = CLICKABLE_SELECTOR) {
  for (const frame of page.frames()) {
    for (const pattern of patterns) {
      const locator = frame.locator(selector).filter({ hasText: pattern }).first();
      const count = await locator.count().catch(() => 0);
      if (!count) continue;
      const visible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
      if (visible) return { frame, locator, pattern: String(pattern) };
    }
  }
  return null;
}

async function clickDuplicateCancel(page) {
  const cancel = await findVisibleTextLocator(page, [/^\s*(取消|Cancel|キャンセル)\s*$/i], CLICKABLE_SELECTOR);
  if (!cancel) return false;
  await cancel.locator.click({ timeout: 5000 }).catch(() => {});
  return true;
}

async function inspectPage(page) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyText = await visiblePageText(page, 6000);
  const sample = `${url}\n${title}\n${bodyText}`;
  const verificationReason = firstPattern(sample, VERIFICATION_PATTERNS);
  const duplicateReason = firstPattern(sample, DUPLICATE_PATTERNS);
  const successReason = firstPattern(sample, SUCCESS_PATTERNS);
  const failureReason = firstPattern(sample, FAILURE_PATTERNS);
  const captchaLike = await hasCaptchaLikeElement(page);
  return {
    url,
    verification: Boolean(verificationReason || captchaLike),
    verificationReason: verificationReason || (captchaLike ? '页面包含平台确认控件。' : ''),
    duplicate: Boolean(duplicateReason),
    duplicateReason,
    success: Boolean(successReason),
    successReason,
    failure: Boolean(failureReason),
    failureReason
  };
}

async function visiblePageText(page, limit = 6000) {
  const chunks = [];
  for (const frame of page.frames()) {
    const text = await frame.locator('body').innerText({ timeout: 1200 }).catch(() => '');
    if (text) chunks.push(text);
    if (chunks.join('\n').length >= limit) break;
  }
  return chunks.join('\n').replace(/\s+/g, ' ').slice(0, limit);
}

async function hasCaptchaLikeElement(page) {
  const selectors = [
    '[id*="captcha" i]',
    '[class*="captcha" i]',
    '[id*="verify" i]',
    '[class*="verify" i]',
    '[id*="security" i]',
    '[class*="security" i]',
    'iframe[src*="captcha" i]',
    'iframe[src*="verify" i]'
  ];
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const count = await frame.locator(selector).count().catch(() => 0);
      if (count > 0) return true;
    }
  }
  return false;
}

function firstPattern(text, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(text)) return pattern.source;
  }
  return '';
}

async function connectBrowser(args, stateFile, eventsFile, meta) {
  const endpoint = normalizeText(args.cdpEndpoint || args['cdp-endpoint'] || process.env.TK_RPA_CDP_ENDPOINT || process.env.CHROME_CDP_ENDPOINT || DEFAULT_CDP_ENDPOINT);
  await writeState(stateFile, {
    status: 'running',
    stage: 'connecting_chrome',
    account: meta.account,
    runDir: meta.runDir,
    targetSuccesses: meta.targetSuccesses,
    candidateCount: meta.candidateCount,
    ...summarizeAttempts(meta.attempts),
    recoveryPoint: null
  });
  await appendEvent(eventsFile, { event: 'connecting_chrome', cdpEndpoint: endpoint });
  try {
    const { chromium } = await importPlaywright();
    const browser = await chromium.connectOverCDP(endpoint, { timeout: toInteger(args.connectTimeoutMs || args['connect-timeout-ms'], 10 * 1000) });
    const context = browser.contexts()[0] || await browser.newContext();
    await appendEvent(eventsFile, { event: 'chrome_connected', contextCount: browser.contexts().length });
    return { browser, context };
  } catch (error) {
    await appendEvent(eventsFile, {
      event: 'chrome_connect_failed',
      cdpEndpoint: endpoint,
      error: trimForLog(error.message, 200)
    });
    await writeState(stateFile, {
      status: 'browser_unavailable',
      stage: 'browser_unavailable',
      account: meta.account,
      runDir: meta.runDir,
      targetSuccesses: meta.targetSuccesses,
      candidateCount: meta.candidateCount,
      ...summarizeAttempts(meta.attempts),
      recoveryPoint: null,
      browser: {
        cdpEndpoint: endpoint,
        error: trimForLog(error.message, 200)
      }
    });
    throw new ExitWithCode(`无法连接当前授权 Chrome CDP：${endpoint}。请确认 Chrome 已用 remote debugging 启动，或传入 --cdp-endpoint。`, 2);
  }
}

async function importPlaywright() {
  try {
    return await import('playwright');
  } catch {}
  const requireFromCwd = createRequire(path.join(process.cwd(), 'noop.cjs'));
  for (const packageName of ['playwright', '@playwright/test']) {
    try {
      return requireFromCwd(packageName);
    } catch {}
  }
  throw new Error('未找到 Playwright。请在项目目录安装依赖后运行，或从包含 node_modules 的 TK 项目目录执行。');
}

async function loadCandidatePool(runDir, args) {
  const files = candidateFilesFromArgs(args);
  const pool = [];
  const seen = new Set();
  for (const file of files) {
    const absolute = path.isAbsolute(file) ? file : path.join(runDir, file);
    const data = await readJson(absolute, null);
    const records = unwrapCandidateArray(data);
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      if (!includeCandidate(record, args)) continue;
      const productId = candidateProductId(record);
      const productUrl = normalizeTkProductUrl(getCandidateValue(record, ['商品链接', '核心 TK 链接', 'product_url', 'tk_product_url', 'tiktokOfficialUrl', 'tiktok_official_url', '链接']), productId);
      const key = productId || normalizeProductUrl(productUrl);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      pool.push({
        ...record,
        _rpa: {
          sourceFile: path.basename(absolute),
          productId,
          productUrl
        }
      });
    }
  }
  return pool;
}

function candidateFilesFromArgs(args) {
  const explicit = [];
  for (const value of arrayOption(args.candidateFile || args['candidate-file'] || args.candidates)) {
    for (const item of String(value).split(',')) {
      const text = item.trim();
      if (text) explicit.push(text);
    }
  }
  return explicit.length ? explicit : DEFAULT_CANDIDATE_FILES;
}

function unwrapCandidateArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.candidates)) return data.candidates;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

function includeCandidate(record, args) {
  if (Boolean(args.includeExcluded || args['include-excluded'])) return true;
  const counted = normalizeText(record['是否计入本次'] || record.includeInRun || record.isIncluded);
  if (counted === '否' || counted.toLowerCase() === 'false') return false;
  if (normalizeText(record['是否旧商品']) === '是') return false;
  if (normalizeText(record['拒绝原因'])) return false;
  return true;
}

function selectNextCandidate({ runDir, candidates, attempts, args }) {
  const successKeys = new Set(attempts.filter(item => item['采集状态'] === '已采集').map(attemptKey).filter(Boolean));
  const attemptedKeys = new Set(attempts.filter(item => VALID_COLLECT_STATUSES.has(item['采集状态'])).map(attemptKey).filter(Boolean));
  const blockedProductId = blockedProductIdFromState(runDir);
  const retryFailed = Boolean(args.retryFailed || args['retry-failed']);
  const retryVerification = Boolean(args.retryVerification || args['retry-verification'] || args.continueBlocked || args['continue-blocked']);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const productId = candidateProductId(candidate);
    const key = candidateKey(candidate);
    if (blockedProductId && productId === blockedProductId && !successKeys.has(key) && retryVerification) {
      return { candidate, index, productId };
    }
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const key = candidateKey(candidate);
    if (!key) continue;
    if (successKeys.has(key)) continue;
    if (attemptedKeys.has(key) && !retryFailed) continue;
    return { candidate, index, productId: candidateProductId(candidate) };
  }
  return null;
}

function blockedProductIdFromState(runDir) {
  try {
    const file = path.join(runDir, 'page_confirmation_state.json');
    const parsed = fsSync.existsSync(file) ? JSON.parse(fsSync.readFileSync(file, 'utf8')) : {};
    if (parsed?.status === 'verification_blocked') return normalizeText(parsed.productId || parsed.product_id || parsed.itemId || parsed['商品ID']);
  } catch {}
  return '';
}

function buildAttempt({ candidate, account, status, reason, startedAt, stage, resultKind = '' }) {
  if (!VALID_COLLECT_STATUSES.has(status)) throw new Error(`无效采集状态：${status}`);
  const now = new Date().toISOString();
  const collectedAt = status === '已采集' ? now : now;
  const row = recordRowFromCandidate(candidate, account, status, reason, collectedAt);
  return {
    productId: candidateProductId(candidate),
    productKey: candidateKey(candidate),
    sourceFile: candidate._rpa?.sourceFile || '',
    stage,
    resultKind,
    startedAt,
    finishedAt: now,
    ...row
  };
}

function recordRowFromCandidate(candidate, account, status, judgement, collectedAt) {
  const productId = candidateProductId(candidate);
  const productUrl = normalizeTkProductUrl(getCandidateValue(candidate, ['商品链接', '核心 TK 链接', 'product_url', 'tk_product_url', 'tiktokOfficialUrl', 'tiktok_official_url', '链接']), productId);
  const row = {
    '账号': normalizeText(getCandidateValue(candidate, ['账号', 'account', 'accountName', 'account_name']) || account),
    '选品分': getCandidateValue(candidate, ['选品分', 'score', 'selectionScore']),
    '商品名称': getCandidateValue(candidate, ['商品名称', 'productName', 'title', 'name']),
    '店铺名': getCandidateValue(candidate, ['店铺名', 'shop_name', 'shopName', 'sellerName']),
    '商品价格': getCandidateValue(candidate, ['商品价格', 'product_price', 'price']),
    '商品近7天销量': getCandidateValue(candidate, ['商品近7天销量', '商品近 7 天销量', 'day7_sales', 'day7_sold_count', 'sales7d']),
    '采集时间': collectedAt || new Date().toISOString(),
    '采集状态': status,
    '选品判断': judgement || (status === '已采集' ? `${baseJudgement(candidate)}；店小秘插件显示采集成功。` : '采集失败：未确认店小秘采集成功。'),
    '商品链接': productUrl,
    'FastMoss 链接': getCandidateValue(candidate, ['FastMoss 链接', 'fastmoss_url', 'fastmossUrl']),
    '出海匠链接': getCandidateValue(candidate, ['出海匠链接', 'chuhaijiang_url', 'chuhaijiangUrl']),
    '店铺链接': getCandidateValue(candidate, ['店铺链接', 'shop_url', 'shopUrl'])
  };
  for (const field of ['店小秘编辑状态', '编辑时间', '编辑标题', '编辑判断']) delete row[field];
  return row;
}

function normalizeAttempts(raw, account) {
  const source = Array.isArray(raw) ? raw : [];
  return source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const status = normalizeCollectStatus(item['采集状态'] || item.collectStatus || item.status);
      if (!status) return null;
      const row = {};
      for (const header of COLLECTION_RECORD_HEADERS) {
        row[header] = item[header] ?? '';
      }
      row['账号'] = row['账号'] || account;
      row['采集状态'] = status;
      row['采集时间'] = row['采集时间'] || item.collectedAt || item.finishedAt || new Date().toISOString();
      row['选品判断'] = row['选品判断'] || item.reason || item.message || (status === '已采集' ? '符合当前选品规则，已采集到店小秘。' : '采集失败：未确认店小秘采集成功。');
      return {
        productId: normalizeText(item.productId || item.product_id || item['商品ID'] || candidateProductId(item)),
        productKey: normalizeText(item.productKey || item.product_key || candidateKey(item)),
        sourceFile: normalizeText(item.sourceFile || item.source_file),
        stage: normalizeText(item.stage),
        resultKind: normalizeText(item.resultKind || item.result),
        startedAt: normalizeText(item.startedAt || item['开始时间']),
        finishedAt: normalizeText(item.finishedAt || row['采集时间']),
        ...row
      };
    })
    .filter(Boolean);
}

function upsertAttempt(attempts, attempt) {
  const key = attemptKey(attempt);
  const next = attempts.filter((item) => attemptKey(item) !== key);
  next.push(attempt);
  return next;
}

async function writeAttemptsAndRecords({ attemptsFile, recordsFile, attempts }) {
  await writeJson(attemptsFile, attempts);
  const recordRows = attempts
    .filter((item) => VALID_COLLECT_STATUSES.has(item['采集状态']))
    .map((item) => Object.fromEntries(COLLECTION_RECORD_HEADERS.map((header) => [header, item[header] ?? ''])));
  await writeCsv(recordsFile, recordRows, COLLECTION_RECORD_HEADERS);
}

function summarizeAttempts(attempts) {
  const valid = attempts.filter((item) => VALID_COLLECT_STATUSES.has(item['采集状态']));
  return {
    attemptedCount: valid.length,
    successCount: valid.filter((item) => item['采集状态'] === '已采集').length,
    failureCount: valid.filter((item) => item['采集状态'] === '采集失败').length
  };
}

function baseJudgement(candidate) {
  return normalizeText(candidate['选品判断'] || candidate.selection_judgement || candidate.selectionJudgement || '符合当前选品规则，已通过候选筛选');
}

function candidateProductId(candidate) {
  return extractProductId(getCandidateValue(candidate, ['商品ID', 'productId', 'product_id', 'itemId', 'item_id']) || getCandidateValue(candidate, ['商品链接', '核心 TK 链接', 'product_url', 'tk_product_url', 'tiktokOfficialUrl', 'tiktok_official_url', '链接']) || candidate._rpa?.productId || '');
}

function candidateKey(candidate) {
  return candidateProductId(candidate) || normalizeProductUrl(getCandidateValue(candidate, ['商品链接', '核心 TK 链接', 'product_url', 'tk_product_url', 'tiktokOfficialUrl', 'tiktok_official_url', '链接'])) || normalizeText(candidate.productKey);
}

function attemptKey(attempt) {
  return normalizeText(attempt.productKey) || normalizeText(attempt.productId) || candidateKey(attempt);
}

function getCandidateValue(record, names) {
  for (const name of names) {
    const value = record?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function normalizeCollectStatus(value) {
  const text = normalizeText(value);
  if (text === '已采集') return '已采集';
  if (text === '采集失败') return '采集失败';
  return '';
}

function normalizeTkProductUrl(value, productId = '') {
  const text = normalizeText(value);
  if (/tiktok\.com/i.test(text)) return text;
  const id = extractProductId(productId || text);
  return id ? `https://www.tiktok.com/view/product/${id}` : '';
}

function normalizeProductUrl(value) {
  const text = normalizeText(value);
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

function extractProductId(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const patterns = [
    /\/(?:view\/product|product)\/(\d{8,})/i,
    /\/e-commerce\/detail\/(\d{8,})/i,
    /(?:product_id|productId|item_id|itemId|id)[=:](\d{8,})/i,
    /\b(\d{16,22})\b/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function accountFromRun(runDir) {
  const manifest = await readJson(path.join(runDir, 'run_manifest.json'), {});
  if (manifest?.account) return manifest.account;
  const candidates = await readJson(path.join(runDir, 'selection_candidates.json'), []);
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const account = normalizeText(candidate?.['账号'] || candidate?.account || candidate?.accountName);
      if (account) return account;
    }
  }
  return '';
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, file);
}

async function writePageConfirmation(runDir, data) {
  await writeJson(path.join(runDir, 'page_confirmation_state.json'), data);
}

async function writeState(file, patch) {
  const previous = await readJson(file, {});
  await writeJson(file, {
    schemaVersion: 1,
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

async function appendEvent(file, event) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, `${JSON.stringify({
    ts: new Date().toISOString(),
    ...event
  })}\n`);
}

async function writeCsv(file, rows, headers) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
  ];
  await fs.writeFile(file, `${lines.join('\n')}\n`);
}

function csvCell(value) {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

async function notifyHumanVerification({ runDir, platform, stage, productId, message }) {
  const args = [
    notifyScript,
    '--run-dir', runDir,
    '--platform', platform,
    '--stage', stage,
    '--product-id', productId,
    '--message', message
  ];
  spawnSync(process.execPath, args, { stdio: 'ignore', timeout: 10 * 1000 });
}

async function safeClosePage(page) {
  await page.close({ runBeforeUnload: false }).catch(() => {});
}

async function waitForPageSettle(page, ms) {
  await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(ms).catch(() => delay(ms));
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      out._.push(item);
      continue;
    }
    const [rawKey, rawValue] = item.slice(2).split(/=(.*)/s, 2);
    const key = camelCase(rawKey);
    if (rawValue !== undefined) {
      addArg(out, key, rawValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      addArg(out, key, next);
      index += 1;
    } else {
      addArg(out, key, true);
    }
  }
  return out;
}

function addArg(out, key, value) {
  if (out[key] === undefined) {
    out[key] = value;
    return;
  }
  if (!Array.isArray(out[key])) out[key] = [out[key]];
  out[key].push(value);
}

function camelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function resolveRunDir(args) {
  const value = args.runDir || args['run-dir'] || args._[0];
  if (!value) throw new ExitWithCode('缺少运行目录：node run-dxm-collection-rpa.mjs <run-dir> --account NOMA', 1);
  return path.resolve(process.cwd(), String(value));
}

function arrayOption(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeVerificationMode(value) {
  const text = normalizeText(value);
  if (text === 'pause') return 'pause';
  if (text === 'wait-pause') return 'pause';
  return 'wait-fail';
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function trimForLog(value, maxLength) {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function toInteger(value, fallback) {
  if (value === Number.POSITIVE_INFINITY) return value;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : fallback;
}

function randomInteger(min, max) {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage() {
  return `
用法:
  node scripts/run-dxm-collection-rpa.mjs <run-dir> --account NOMA [options]

核心参数:
  --target-successes 20          目标成功采集数，默认读取 run_manifest.targetCount 或 20
  --candidate-file <file>        候选文件，可重复或用逗号分隔；默认 selection_candidates.json,final_collection_candidates.json
  --cdp-endpoint <url>           当前授权 Chrome CDP 地址，默认 ${DEFAULT_CDP_ENDPOINT}
  --verification-mode wait-fail  验证等待超时后写采集失败并补下一个候选
  --verification-mode pause      验证等待超时后只保留恢复点，用户说“继续”时从同一商品恢复
  --continue-blocked            优先恢复 page_confirmation_state.json 里的阻塞商品
  --retry-verification           允许重试因验证阻塞的失败商品
  --limit <n>                    本次最多处理 n 个商品
  --dry-run                      只汇总候选、attempts 和下一条，不打开浏览器
  --rebuild-records             只从 collection_attempts.json 重建 collection_records.csv

输出文件:
  rpa_state.json
  rpa_events.jsonl
  page_confirmation_state.json
  collection_attempts.json
  collection_records.csv
`.trim();
}

main().catch((error) => {
  if (error instanceof ExitWithCode) {
    console.error(JSON.stringify({ ok: false, error: error.message, ...(error.meta || {}) }, null, 2));
    process.exit(error.code);
  }
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
