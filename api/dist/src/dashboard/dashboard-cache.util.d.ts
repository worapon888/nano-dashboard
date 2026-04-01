export declare const DASHBOARD_SUMMARY_CACHE_PREFIX = "dashboard:summary:user";
export declare function getDashboardSummaryHotCacheKey(userId: string, range: string, volumeTf: string, pnlRange: string): string;
export declare function getDashboardSummaryStaleCacheKey(userId: string, range: string, volumeTf: string, pnlRange: string): string;
export declare function getDashboardSummaryCachePattern(userId?: string): string;
