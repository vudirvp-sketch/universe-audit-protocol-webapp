# Universe Audit Protocol — CORS Proxy Worker

## Current Deployment

- **Worker URL**: https://universe-audit-proxy.vudirvp.workers.dev
- **Account**: weathered-paper-631c
- **Account ID**: 5a7a04ab064205a1f901ebdb7b40dcc0
- **Workers subdomain**: vudirvp

## Deployment

### Option A: Wrangler CLI (recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Deploy (one command):
   ```bash
   npm run deploy
   ```
   Or: `npx wrangler deploy`

4. The Worker will be available at: `https://universe-audit-proxy.vudirvp.workers.dev`

### Option B: Environment variables (CI/CD)

For non-interactive environments (GitHub Actions), set:
```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ACCOUNT_ID="5a7a04ab064205a1f901ebdb7b40dcc0"
npx wrangler deploy
```

## Configuration

The `wrangler.toml` file contains the production route:
```toml
[env.production]
routes = [
  { pattern = "universe-audit-proxy.vudirvp.workers.dev/*" }
]
```

If deploying to a different Cloudflare account, update the subdomain in the route pattern.

## How It Works

This Worker acts as a CORS proxy that routes LLM API requests to the correct provider endpoint.
It transforms request headers and auth methods per provider:

- **OpenAI-compatible** (OpenAI, DeepSeek, Groq, OpenRouter, Mistral): `Authorization: Bearer` header
- **Anthropic**: `x-api-key` header + `anthropic-version` header
- **Google Gemini**: API key in query string

No storage. No logging. No API keys stored. The proxy only exists in memory during request processing.
