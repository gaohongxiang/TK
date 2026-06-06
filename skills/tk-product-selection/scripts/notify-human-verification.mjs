#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_SOUND = '/System/Library/Sounds/Glass.aiff';
const DEFAULT_ALERTS_FILE = '.human-verification-alerts.json';
const DEFAULT_VOICE = 'Tingting';
const DEFAULT_SPEECH_TEXT = 'TikTok 出验证了，请处理滑块验证。';

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      out._.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      index += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function safePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function alertKey(args) {
  if (args.key) return safePart(args.key);
  return [
    args.status || 'verification_blocked',
    args.platform,
    args.stage,
    args.productId || args['product-id'] || args.itemId || args['item-id'],
    args.url || args.pageUrl || args['page-url']
  ]
    .map(safePart)
    .filter(Boolean)
    .join('|') || 'verification_blocked';
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
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, timeout = 5000) {
  const result = spawnSync(command, args, { stdio: 'ignore', timeout });
  return {
    ok: !result.error && result.status === 0,
    command,
    status: result.status,
    error: result.error?.message || ''
  };
}

function notifySystem({ title, message, soundName, dryRun }) {
  if (dryRun || process.env.TK_HUMAN_VERIFICATION_NOTIFICATION === '0') {
    return { shown: false, method: dryRun ? 'dry-run' : 'disabled' };
  }
  const script = [
    'display notification',
    JSON.stringify(message),
    'with title',
    JSON.stringify(title),
    'sound name',
    JSON.stringify(soundName)
  ].join(' ');
  const result = runCommand('osascript', ['-e', script], 5000);
  return {
    shown: result.ok,
    method: 'osascript-notification',
    title,
    soundName,
    ...(result.ok ? {} : { error: result.error || `exit ${result.status}` })
  };
}

function speakChinese({ text, voice, dryRun }) {
  if (dryRun || process.env.TK_HUMAN_VERIFICATION_SAY === '0') {
    return { spoken: false, method: dryRun ? 'dry-run' : 'disabled' };
  }
  const selectedVoice = voice || process.env.TK_HUMAN_VERIFICATION_VOICE || DEFAULT_VOICE;
  const message = text || process.env.TK_HUMAN_VERIFICATION_SPEECH || DEFAULT_SPEECH_TEXT;
  let result = runCommand('say', ['-v', selectedVoice, message], 10000);
  if (result.ok) return { spoken: true, method: 'say', voice: selectedVoice, text: message };

  result = runCommand('say', [message], 10000);
  return {
    spoken: result.ok,
    method: result.ok ? 'say-default' : 'say-failed',
    voice: result.ok ? 'default' : selectedVoice,
    text: message,
    ...(result.ok ? {} : { error: result.error || `exit ${result.status}` })
  };
}

async function playSound({ sound, dryRun }) {
  if (dryRun || process.env.TK_HUMAN_VERIFICATION_SOUND === '0') {
    return { played: false, method: dryRun ? 'dry-run' : 'disabled' };
  }

  const soundPath = sound || process.env.TK_HUMAN_VERIFICATION_SOUND || DEFAULT_SOUND;
  if (soundPath && await fileExists(soundPath)) {
    const result = spawnSync('afplay', [soundPath], { stdio: 'ignore', timeout: 5000 });
    if (!result.error && result.status === 0) {
      return { played: true, method: 'afplay', sound: soundPath };
    }
  }

  const beep = spawnSync('osascript', ['-e', 'beep 2'], { stdio: 'ignore', timeout: 5000 });
  if (!beep.error && beep.status === 0) return { played: true, method: 'osascript-beep' };

  process.stdout.write('\u0007');
  return { played: true, method: 'terminal-bell' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDir = args.runDir || args['run-dir'] || (args.stateFile || args['state-file'] ? path.dirname(args.stateFile || args['state-file']) : process.cwd());
  const alertsFile = args.alertsFile || args['alerts-file'] || path.join(runDir, DEFAULT_ALERTS_FILE);
  const key = alertKey(args);
  const force = Boolean(args.force);
  const dryRun = Boolean(args.dryRun || args['dry-run']);
  const now = new Date().toISOString();
  const alerts = await readJson(alertsFile, {});
  const previous = alerts[key];

  if (previous && !force) {
    console.log(JSON.stringify({
      ok: true,
      notified: false,
      deduped: true,
      key,
      previousNotifiedAt: previous.notifiedAt,
      alertsFile
    }, null, 2));
    return;
  }

  const productId = safePart(args.productId || args['product-id'] || args.itemId || args['item-id']);
  const speechText = safePart(args.speech || args['speech-text'] || process.env.TK_HUMAN_VERIFICATION_SPEECH || DEFAULT_SPEECH_TEXT);
  const notificationMessage = safePart(args.message || '页面触发人机验证，需要人工确认。');
  const notificationResult = notifySystem({
    title: safePart(args.title || 'TK 采集验证'),
    message: productId ? `${notificationMessage} 商品 ${productId}` : notificationMessage,
    soundName: safePart(args.notificationSound || args['notification-sound'] || 'Glass'),
    dryRun
  });
  const speechResult = speakChinese({
    text: speechText,
    voice: args.voice,
    dryRun
  });
  const soundResult = await playSound({ sound: args.sound, dryRun });
  alerts[key] = {
    status: args.status || 'verification_blocked',
    platform: safePart(args.platform),
    stage: safePart(args.stage),
    productId,
    message: notificationMessage,
    notifiedAt: now,
    notification: notificationResult,
    speech: speechResult,
    sound: soundResult
  };
  await writeJson(alertsFile, alerts);

  console.log(JSON.stringify({
    ok: true,
    notified: true,
    deduped: false,
    key,
    alertsFile,
    notification: notificationResult,
    speech: speechResult,
    sound: soundResult
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
