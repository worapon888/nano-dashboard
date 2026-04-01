export const DASHBOARD_SUMMARY_CACHE_PREFIX = 'dashboard:summary:user';

export function getDashboardSummaryHotCacheKey(
  userId: string,
  range: string,
  volumeTf: string,
  pnlRange: string,
): string {
  return `${DASHBOARD_SUMMARY_CACHE_PREFIX}:${userId}:${range}:volume:${volumeTf}:pnl:${pnlRange}`;
}

export function getDashboardSummaryStaleCacheKey(
  userId: string,
  range: string,
  volumeTf: string,
  pnlRange: string,
): string {
  return `${getDashboardSummaryHotCacheKey(userId, range, volumeTf, pnlRange)}:stale`;
}

export function getDashboardSummaryCachePattern(userId?: string): string {
  return userId
    ? `${DASHBOARD_SUMMARY_CACHE_PREFIX}:${userId}:*`
    : `${DASHBOARD_SUMMARY_CACHE_PREFIX}:*`;
}
