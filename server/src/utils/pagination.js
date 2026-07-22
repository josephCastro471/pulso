function parsePagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || 20;
  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function parseDateRange(query) {
  const range = {};
  if (query.from) {
    range.gte = new Date(query.from);
  }
  if (query.to) {
    const to = new Date(query.to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
      to.setUTCHours(23, 59, 59, 999);
    }
    range.lte = to;
  }
  return Object.keys(range).length > 0 ? range : undefined;
}

module.exports = { parsePagination, parseDateRange };
