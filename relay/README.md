# Local relay

Local replacement for the Cloudflare Worker (`worker/cors-proxy.js` v9).
One process serves the Next.js static export **and** proxies LLM API calls, so
no Cloudflare account, no `wrangler`, and no API key in the browser are needed.

- ESM, **Node.js >= 18**, **zero dependencies**.
- Binds `127.0.0.1` only.
- The API key can live in the relay's environment (`LLM_API_KEY`) and never be
  sent to the page.

## 1. Build the static export first

The relay serves `out/`, so run the build once (and after every code change):

```bash
npm run build        # or: npm run preview  (build + relay in one command)
```

## 2. Run the relay

```bash
node relay/relay.mjs --port 8787 --dir out
# or simply: npm run relay
```

```
[relay] relay-v1 listening on http://127.0.0.1:8787
[relay] static root: <abs path>\out
[relay] LLM_API_KEY from env: no
```

Open <http://127.0.0.1:8787>. `--port` and `--dir` are optional
(`--port=8787`, `--dir=out`, `--help` also work). The port defaults to `8787`,
the directory to `out/`.

Keep the key out of the browser (recommended):

```powershell
$env:LLM_API_KEY = 'sk-your-key'
node relay/relay.mjs
```

## 3. HTTP contract

### Static files

`GET` / `HEAD` any path, served from `--dir`:

1. exact file (`/assets/app.js`, `/logo.svg`, `/foo.txt`),
2. `<path>.html` for extensionless routes (`/about` → `about.html`),
3. `<path>/index.html` for directories,
4. SPA fallback to `index.html` for extensionless paths that match no file.

`Content-Type` comes from the file extension. A missing file **with** an
extension returns `404`; paths that escape `--dir` (`..`, `%2e%2e`) return
`403`. Any other method on a static path returns `405`.

### `GET /api/health`

```json
{ "status": "ok", "keyFromEnv": true, "version": "relay-v1", "uptime_seconds": 12 }
```

`keyFromEnv` is `true` when `LLM_API_KEY` or any `LLM_API_KEY_<PROVIDER>` is
set in the relay's environment. Always `Cache-Control: no-store`.

### `POST /api/llm`

Request body (same envelope as the old worker):

```json
{
  "provider": "openai",
  "apiKey": "sk-... (optional when an env key is set)",
  "targetUrl": "https://api.openai.com/v1/chat/completions",
  "payload": "{\"model\":\"gpt-4.1-mini\",\"messages\":[]}"
}
```

- `provider` — one of `openai`, `anthropic`, `google`, `deepseek`, `groq`,
  `openrouter`, `mistral`, `qwen`, `kimi`, `xai`, `together`, `huggingface`,
  `zai`, or `custom`.
- `targetUrl` — must be `https://`, with no credentials and the default port.
  Its host is pinned to the provider's API host; `custom` may only target a
  host listed in `ALLOWED_CUSTOM_HOSTS`.
- `payload` — the provider request body as a JSON **string**, forwarded
  unchanged.
- `apiKey` — optional when the relay has an env key; the env key wins over the
  body key.

Auth injected by the relay (the client's own headers are not forwarded):

| provider | headers added |
| --- | --- |
| `anthropic` | `x-api-key: <key>`, `anthropic-version: 2023-06-01` |
| `google` | `x-goog-api-key: <key>` (header — the key is **not** added to the URL) |
| `openrouter` | `Authorization: Bearer <key>`, `HTTP-Referer`, `X-Title` |
| everything else, incl. `custom` | `Authorization: Bearer <key>` |

The upstream status code and response body are returned as-is.
`Cache-Control: no-store` is always set on `/api/*`.

### `POST /api/models`

Forwards a provider's model-list `GET` so the settings screen can show the live
catalog even when the browser cannot reach the provider directly:

```json
{ "provider": "openai", "apiKey": "sk-... (optional with an env key)", "targetUrl": "https://api.openai.com/v1/models" }
```

- Same provider allowlist and the same host pinning as `/api/llm`: the host in
  `targetUrl` must be one of that provider's API hosts.
- The relay injects the same auth headers as for chat calls and answers with the
  provider's status and JSON body unchanged (the browser parses it, so the relay
  carries no per-provider schema).
- `openrouter` is the only provider allowed **without** a key — its catalog is
  public. Every other provider answers `400 missing_api_key` when neither the
  body nor the environment supplies one.
- Methods other than `POST` → `405`. Always `Cache-Control: no-store`; the key
  and the body are never logged.

**Streaming.** Send `Accept: text/event-stream`; when the provider answers
`2xx`, the response body is forwarded chunk by chunk (headers are flushed
first, nothing is buffered) and the provider's `Content-Type` is preserved.
A provider error response is buffered and returned as JSON.

**CORS / preflight.** `OPTIONS /api/llm` returns `204` with CORS headers for
loopback origins (`http://localhost[:port]`, `http://127.0.0.1[:port]`) plus
anything in `ALLOWED_ORIGINS`. The relay never answers
`Access-Control-Allow-Origin: *`. Requests with a foreign `Origin` are rejected
with `403` before the provider is called. Requests without `Origin`
(curl, scripts) are allowed.

Error responses (JSON `{ "\<error\>": ..., "message": ... }`):

| status | `error` | meaning |
| --- | --- | --- |
| 400 | `invalid_json` | body is not a JSON object |
| 400 | `missing_provider` / `missing_fields` | required field missing |
| 400 | `unknown_provider` | provider not in the list above |
| 400 | `missing_api_key` | no body key and no env key |
| 400 | `invalid_target_url` | non-https, credentials, port, or wrong host |
| 403 | `host_not_allowed` | `Host` is not `localhost` / `127.0.0.1` (DNS rebinding) |
| 403 | `origin_not_allowed` | browser `Origin` not allowlisted |
| 403 | `custom_provider_disabled` | `provider: "custom"` host not in `ALLOWED_CUSTOM_HOSTS` |
| 413 | `payload_too_large` | body over `MAX_BODY_SIZE_BYTES` (real bytes) |
| 502 | `network` | provider unreachable |
| 504 | `timeout` | provider did not answer within 300 s |

## 4. Environment variables

| variable | default | meaning |
| --- | --- | --- |
| `LLM_API_KEY` | — | global key injected server-side; **overrides** the body `apiKey` |
| `LLM_API_KEY_<PROVIDER>` | — | per-provider key (`LLM_API_KEY_OPENAI`, `LLM_API_KEY_GOOGLE`, ...); wins over `LLM_API_KEY` |
| `ALLOWED_CUSTOM_HOSTS` | — | comma-separated hostnames allowed for `provider: "custom"`, e.g. `api.example.com` |
| `ALLOWED_ORIGINS` | — | extra browser origins allowed to call `/api/llm` (loopback is always allowed) |
| `MAX_BODY_SIZE_BYTES` | `2097152` (2 MB) | request body limit, enforced on received bytes |
| `PROVIDER_TIMEOUT_MS` | `300000` (300 s) | upstream response timeout / SSE idle timeout (tests set it small) |

Example:

```powershell
$env:LLM_API_KEY = 'sk-your-key'
$env:ALLOWED_CUSTOM_HOSTS = 'llm.example.com'
node relay/relay.mjs --port 8787 --dir out
```

## 5. Security model

- **Loopback only.** `server.listen(port, '127.0.0.1')` — other machines
  cannot reach the relay, even on a LAN.
- **DNS-rebinding guard.** Every request (static and `/api`) must carry a
  `Host` of `localhost`, `127.0.0.1` or `[::1]`, optionally with a port.
  A poisoned browser `Host` (`evil.example`) gets `403` before routing.
- **Origin guard.** Browser `Origin` must be loopback or listed in
  `ALLOWED_ORIGINS`. No wildcard CORS headers are ever emitted.
- **No open relay.** `targetUrl` is pinned to the declared provider's API host
  (for both `/api/llm` and `/api/models`); `custom` requires an explicit
  `ALLOWED_CUSTOM_HOSTS` entry. `https://` only, no credentials in the URL,
  default port only.
- **Key handling.** With `LLM_API_KEY`/`LLM_API_KEY_<PROVIDER>` set, the key
  never enters the page or the request body. The relay never writes a key,
  a request body, or a full target URL to the log; it logs only
  `provider`, `keySource` (`env` / `env:provider` / `body`), status, elapsed
  time and stream byte count.
- **Body limit** is enforced on the bytes actually received, not on
  `Content-Length`; oversized bodies are rejected with `413` before any
  provider request.
- **Logs are metadata only** (`[relay] llm provider=openai keySource=env
  status=200 stream=false ms=1234`).

This is a local developer tool: any process on the same machine (same user)
can call it, and the key in the body route travels over loopback in plaintext.
Run it on a trusted workstation.

## 6. Differences from the Cloudflare Worker (v9)

- No server-side 429/5xx retry loop and no per-IP rate limiting. The browser
  client already avoids retry cascades; if you need retries, add them in the
  client or in a wrapper around the relay.
- Google auth is sent as the `x-goog-api-key` header instead of a `?key=`
  query parameter, so the key cannot leak through URLs or logs.
- `custom` endpoints must be `https://` (no `http://localhost` endpoints).
- Static export serving, `/api/health` and the CLI are new.

## 7. Tests

```bash
npx vitest run __tests__/relay --reporter=dot
```

The suite is in-process (no listening sockets, provider `fetch` is stubbed) and
covers: static serving + SPA fallback + traversal, Host/Origin guards, provider
host pinning, per-provider auth headers, env-key precedence, real-byte body
limit, health, no-store headers, streaming passthrough, timeouts, the
`/api/models` catalog proxy (including the keyless OpenRouter exception), and
the "no key/body in logs" rule.

## 8. Library API

```js
import {
  createRelayHandler, // (options) => (req, res) => Promise<void>
  createRelayServer,  // (options) => http.Server (not listening)
  startRelay,         // async ({ port, dir, ...options }) => { server, port, url, rootDir }
  PROVIDER_HOSTS,
  buildUpstreamHeaders,
  parseArgs,
} from './relay/relay.mjs';
```

Options: `rootDir`, `env`, `fetchImpl` (injectable for tests), `logger`.
