// Type surface for the plain-JS Cloudflare Worker (worker/cors-proxy.js),
// so the vitest security suite can import and exercise its fetch handler.
export interface ProxyWorkerEnv {
  MAX_REQUESTS_PER_MINUTE?: string;
  MAX_BODY_SIZE_BYTES?: string;
  PROVIDER_TIMEOUT_MS?: string;
  PROVIDER_STREAMING_TIMEOUT_MS?: string;
  ALLOWED_ORIGINS?: string;
  ALLOWED_CUSTOM_HOSTS?: string;
}

declare const worker: {
  fetch: (request: Request, env?: ProxyWorkerEnv, ctx?: unknown) => Promise<Response>;
};

export default worker;
