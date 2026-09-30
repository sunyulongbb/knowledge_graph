export function ok(message: string, data: any = {}) {
  return Response.json({
    success: true,
    message,
    data,
    error: null,
  });
}

export function fail(
  message: string,
  code = "SPARQL_ERROR",
  detail: any = null,
  status = 400,
) {
  return Response.json(
    {
      success: false,
      message,
      data: null,
      error: {
        code,
        detail,
      },
    },
    { status },
  );
}
