export declare function successResponse<T>(data: T, message?: string, meta?: Record<string, any>): {
    meta?: Record<string, any> | undefined;
    success: boolean;
    message: string;
    data: T;
};
