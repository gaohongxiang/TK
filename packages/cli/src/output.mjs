function writeResult(result, options = {}) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.message) process.stdout.write(`${result.message}\n`);
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  return error;
}

function formatList(items) {
  return items.length ? items.join('、') : '无';
}

export {
  fail,
  formatList,
  writeResult
};
