# Universe Audit Protocol — CORS Proxy Worker

## Deployment

### Wrangler CLI (recommended)

1. Install dependencies (lockfile is committed):
   ```bash
   npm ci
   ```

2. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

### CI/CD (non-interactive)

Set environment variables and deploy:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
npx wrangler deploy
```

## How It Works

This Worker acts as a CORS proxy that routes LLM API requests to the correct provider endpoint.
It transforms request headers and auth methods per provider:

- **OpenAI-compatible** (OpenAI, DeepSeek, Groq, OpenRouter, Mistral): `Authorization: Bearer` header
- **Anthropic**: `x-api-key` header + `anthropic-version` header
- **Google Gemini**: API key in query string

No storage. No logging of request bodies. The proxy only exists in memory during request processing.

## Security model (v9)

The proxy is deliberately **not** a general-purpose relay:

- **Provider host pinning.** `targetUrl` must point at the API host of the provider named in the request: `openai → api.openai.com`, `anthropic → api.anthropic.com`, `google → generativelanguage.googleapis.com`, `deepseek → api.deepseek.com`, `groq → api.groq.com`, `openrouter → openrouter.ai`, `mistral → api.mistral.ai`, `qwen → dashscope.aliyuncs.com`, `kimi → api.moonshot.cn`, `xai → api.x.ai`, `together → api.together.xyz`, `huggingface → api-inference.huggingface.co`, `zai → api.z.ai`. Anything else is rejected with `400 invalid_target_url`.
- **Custom endpoints are opt-in per deployment.** `provider: "custom"` is accepted only for hostnames listed in `ALLOWED_CUSTOM_HOSTS`. The default is empty, so a shared proxy cannot be pointed at arbitrary hosts. Users who need a custom endpoint self-host this worker and set the env var.
- **Origin allowlist.** Requests carrying an `Origin` header are rejected unless that origin is in `ALLOWED_ORIGINS` (defaults: the production Pages domain, previews of the same project, `localhost:3000`). CORS responses never use `*`.
- **Key hygiene.** The API key is never written to logs, never echoed in error bodies, and never included in a URL except Gemini's required query-string auth. Responses are `Cache-Control: no-store`. Error bodies are re-wrapped so no upstream encoding headers are passed through.
- **Limits.** Per-IP in-memory rate limit, real byte-size limit on the received body (not just `Content-Length`), and an idle timeout on streaming that injects an SSE error event instead of hanging.

### Configuration

Set in `wrangler.toml` `[vars]` (or `wrangler secret put` / dashboard):

| Variable | Default | Meaning |
|---|---|---|
| `ALLOWED_ORIGINS` | production Pages origin + previews + localhost:3000 | Comma-separated allowed browser origins |
| `ALLOWED_CUSTOM_HOSTS` | *(empty)* | Comma-separated hostnames for `provider: "custom"` |
| `MAX_REQUESTS_PER_MINUTE` | `60` | Per-IP rate limit, per isolate |
| `MAX_BODY_SIZE_BYTES` | `2097152` | Maximum accepted request body |
| `PROVIDER_TIMEOUT_MS` | `300000` | Buffered request timeout |
| `PROVIDER_STREAMING_TIMEOUT_MS` | `300000` | Max silence between stream chunks |

### Verify a deployment

```bash
curl -s https://<worker>.workers.dev/health                       # {"status":"ok","version":"v9",...}
curl -si -X OPTIONS https://<worker>.workers.dev/ -H "Origin: https://evil.example"   # HTTP 403, no ACAO
curl -si -X OPTIONS https://<worker>.workers.dev/ -H "Origin: https://universe-audit-protocol.pages.dev"  # echoed origin, not *
```

Known residual limits: rate limiting is per-isolate (a speed bump, not a hard quota), requests without an `Origin` header are not browser-gated (they are still limited to pinned provider hosts), and the whole body is buffered before the size check.

