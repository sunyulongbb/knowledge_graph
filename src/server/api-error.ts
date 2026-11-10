export function apiErrorResponse(error: unknown): Response {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const corrupt = code === 'SQLITE_CORRUPT' || code.startsWith('SQLITE_CORRUPT_');
  return Response.json({
    error: corrupt ? '数据库文件损坏，个人记录暂时无法加载，请联系管理员恢复数据库。' : '服务器暂时无法处理请求，请稍后重试。',
    code: corrupt ? 'DATABASE_CORRUPT' : 'INTERNAL_SERVER_ERROR',
  }, { status: corrupt ? 503 : 500, headers: { 'Cache-Control': 'private, no-store' } });
}
