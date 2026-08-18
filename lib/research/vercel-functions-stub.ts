/** Browser stub for `@vercel/functions` — no Runtime Cache / IP helpers in client. */

export function getCache(): never {
  throw new Error("@vercel/functions is not available in the browser");
}

export function ipAddress(_req: Request): undefined {
  return undefined;
}
