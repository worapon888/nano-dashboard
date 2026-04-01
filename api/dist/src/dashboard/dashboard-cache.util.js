"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DASHBOARD_SUMMARY_CACHE_PREFIX = void 0;
exports.getDashboardSummaryHotCacheKey = getDashboardSummaryHotCacheKey;
exports.getDashboardSummaryStaleCacheKey = getDashboardSummaryStaleCacheKey;
exports.getDashboardSummaryCachePattern = getDashboardSummaryCachePattern;
exports.DASHBOARD_SUMMARY_CACHE_PREFIX = 'dashboard:summary:user';
function getDashboardSummaryHotCacheKey(userId, range, volumeTf, pnlRange) {
    return `${exports.DASHBOARD_SUMMARY_CACHE_PREFIX}:${userId}:${range}:volume:${volumeTf}:pnl:${pnlRange}`;
}
function getDashboardSummaryStaleCacheKey(userId, range, volumeTf, pnlRange) {
    return `${getDashboardSummaryHotCacheKey(userId, range, volumeTf, pnlRange)}:stale`;
}
function getDashboardSummaryCachePattern(userId) {
    return userId
        ? `${exports.DASHBOARD_SUMMARY_CACHE_PREFIX}:${userId}:*`
        : `${exports.DASHBOARD_SUMMARY_CACHE_PREFIX}:*`;
}
//# sourceMappingURL=dashboard-cache.util.js.map