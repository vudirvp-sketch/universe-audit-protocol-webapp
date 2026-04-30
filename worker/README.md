# Universe Audit Protocol — CORS Proxy Worker

## Deployment

### Wrangler CLI (recommended)

1. Install dependencies:
   ```bash
   npm install
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

No storage. No logging. No API keys stored. The proxy only exists in memory during request processing.
