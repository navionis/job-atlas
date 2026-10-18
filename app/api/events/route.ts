import { getSession } from "../../../lib/auth";
import { snapshot } from "../../../lib/feeds";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const email = getSession(request)?.email || "";
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let busy = false;
  let lastSig = "";
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {}
      };
      const send = async () => {
        if (closed || busy) return;
        busy = true;
        try {
          const data = await snapshot(email);
          // Skip identical payloads — jobs/sources only change when a feed
          // refreshes (which bumps updatedAt); statuses are small enough to
          // hash into the signature directly.
          const sig = data.updatedAt + ":" + JSON.stringify(data.statuses);
          if (sig !== lastSig && !closed) {
            lastSig = sig;
            controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(data)}\n\n`));
          }
        } catch {
          if (!closed)
            controller.enqueue(encoder.encode('event: feed-error\ndata: {"message":"Feed unavailable"}\n\n'));
        } finally {
          busy = false;
        }
      };
      controller.enqueue(encoder.encode("retry: 10000\n\n"));
      void send();
      timer = setInterval(() => void send(), 30000);
      closeTimer = setTimeout(close, 4 * 60000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;
      clearInterval(timer);
      clearTimeout(closeTimer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
