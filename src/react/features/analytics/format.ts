function formatInteger(value: number, locale = 'ja-JP') {
  return Math.round(Number(value) || 0).toLocaleString(locale);
}

function formatYen(value: number) {
  return `${formatInteger(value)} 円`;
}

function formatPercent(value: number, digits = 2) {
  return `${((Number(value) || 0) * 100).toFixed(digits)}%`;
}

function shortenText(value: string, max = 46) {
  const text = String(value || '').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export { formatInteger, formatPercent, formatYen, shortenText };
