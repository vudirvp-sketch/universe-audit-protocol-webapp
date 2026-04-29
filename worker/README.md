# Universe Audit Protocol — CORS Proxy Worker

## Deployment

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

4. Update the proxy URL in the main app settings to match your deployed Worker URL.

## Configuration

Edit `wrangler.toml` and replace `<your-subdomain>` with your actual Cloudflare Workers subdomain.

## How It Works

This Worker acts as a CORS proxy that routes LLM API requests to the correct provider endpoint.
It transforms request headers and auth methods per provider:

- **OpenAI-compatible** (OpenAI, DeepSeek, Groq, OpenRouter, Mistral): `Authorization: Bearer` header
- **Anthropic**: `x-api-key` header + `anthropic-version` header
- **Google Gemini**: API key in query string

No storage. No logging. No API keys stored. The proxy only exists in memory during request processing.
