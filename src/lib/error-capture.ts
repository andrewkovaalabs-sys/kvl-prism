// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

type CapturedEntry = { error: unknown; at: number };

const capturedErrors: CapturedEntry[] = [];
const MAX_QUEUE = 5;
const TTL_MS = 5_000;

function record(error: unknown) {
  capturedErrors.push({ error, at: Date.now() });
  if (capturedErrors.length > MAX_QUEUE) {
    const dropped = capturedErrors.shift();
    if (dropped) {
      console.warn("[error-capture] Dropped oldest uncollected error:", dropped.error);
    }
  }
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  const now = Date.now();
  // Evict expired entries
  while (capturedErrors.length > 0 && now - capturedErrors[0].at > TTL_MS) {
    capturedErrors.shift();
  }
  if (capturedErrors.length === 0) return undefined;
  return capturedErrors.pop()!.error;
}
