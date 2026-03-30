export function successResponse<T>(
  data: T,
  message = 'Request successful',
  meta?: Record<string, any>,
) {
  return {
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  };
}
