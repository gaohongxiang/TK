function integer(value, locale = 'ja-JP') {
  return Math.round(Number(value) || 0).toLocaleString(locale);
}

function yen(value) {
  return `${integer(value)} 円`;
}

function percent(value, digits = 2) {
  const next = Number(value) || 0;
  return `${(next * 100).toFixed(digits)}%`;
}

export const TKFormat = {
  integer,
  yen,
  percent
};

export {
  integer,
  yen,
  percent
};
