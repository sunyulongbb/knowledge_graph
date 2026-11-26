export function wikidataImportStream(run: (log: (progress: number, message: string, extra?: object) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      let closed = false;
      const log = (progress: number, message: string, extra = {}) => {
        if (!closed) { try { controller.enqueue(encoder.encode(JSON.stringify({ progress, message, ...extra }) + '\n')); } catch { closed = true; } }
      };
      void run(log).catch(error => log(100, error instanceof Error ? error.message : String(error), { error: true }))
        .finally(() => { if (!closed) controller.close(); });
    },
  }), { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } });
}
