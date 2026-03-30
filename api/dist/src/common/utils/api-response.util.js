"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
function successResponse(data, message = 'Request successful', meta) {
    return {
        success: true,
        message,
        data,
        ...(meta ? { meta } : {}),
    };
}
//# sourceMappingURL=api-response.util.js.map