function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      positional.push(...argv.slice(index + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eqIndex = arg.indexOf('=');
    if (eqIndex > 2) {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { positional, flags };
}

function getStringFlag(flags, names, fallback = '') {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = flags[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function hasFlag(flags, name) {
  return Boolean(flags[name]);
}

export {
  getStringFlag,
  hasFlag,
  parseArgs
};
