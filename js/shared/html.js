/* ============================================================
 * 共享 HTML 工具
 * ============================================================ */
const TKHtml = (function () {
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
    ));
  }

  function shorten(value, max = 46) {
    const text = String(value || '').trim();
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  return {
    escape,
    shorten
  };
})();
