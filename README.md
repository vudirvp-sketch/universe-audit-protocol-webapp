# Universe Audit Protocol v16

AI-powered tool for auditing fictional worlds and narratives through a 5-block sequential pipeline and five coupled audit dimensions. The verdict is qualitative: no numeric scores, no checklist percentages. No deployment, no downloads — just open the link, enter your API key, and start analyzing.

The canonical specification is [`UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16`](./UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16) in the repository root.

## Quick Start

1. **Open the app**: [universe-audit-protocol.pages.dev](https://universe-audit-protocol.pages.dev)
2. **Click the gear icon** (Settings) in the header
3. **Select your LLM provider** (Google Gemini and Groq have free tiers!)
4. **Enter your API key**
5. **Click Save** — that's it!

The CORS proxy is pre-configured. You don't need to deploy anything.

## Security and API key handling

The app is a static site: there is no backend and no server-side provider secret. Your API key is entered in the browser and used for requests you start.

Where the key lives:

- **Default:** `localStorage` under `universe-audit-settings`, so it survives reloads and browser restarts. It is plaintext — anyone with access to the browser profile, a full-disk backup, or an extension with host permissions can read it.
- **Session-only:** enable «Не сохранять ключ на диск» in Settings. The key is then written to `sessionStorage` only (survives a reload of the tab, dies when the tab closes) and the `localStorage` entry stores `apiKey: null`.

Where the key travels:

- The browser sends it to the CORS proxy configured in Settings → Advanced, which forwards it to the provider. With the bundled proxy (`universe-audit-proxy.vudirvp.workers.dev`) the proxy operator can technically observe traffic, so for maximum privacy deploy your own worker from [`worker/`](./worker) and point Settings at it.
- The proxy does not store or log keys (v9 logs contain no key material in any form), and every response is `no-store`.
- Before sending anything, the client validates the proxy URL (https only, except `localhost` for local development) and, for custom providers, the base URL. `http://` proxies are refused so a key cannot be posted in cleartext.

Proxy hardening (v9):

- **No open relay.** The worker accepts only the API host of the provider named in the request (`api.openai.com` for `openai`, etc.). Custom endpoints are disabled unless the host is listed in `ALLOWED_CUSTOM_HOSTS` (empty by default).
- **Origin allowlist.** `Access-Control-Allow-Origin` is echoed only for allowlisted app origins (production Pages domain, Pages previews of the same project, `localhost:3000`); it is never `*`. A custom domain must be added to `ALLOWED_ORIGINS`.
- **Real body-size limit**, enforced on received bytes rather than `Content-Length`; streaming stall timeout; no key in logs or error payloads.

Residual risks worth knowing: a malicious browser extension or a compromise of the proxy deployment can still read the key while it is in use; disabling persistence (session-only mode) and using your own proxy are the two mitigations this app offers. Prompt-injected model output cannot exfiltrate the key: rendered report HTML is escaped and raw HTML from the model is not enabled.

## What it does

The audit examines five coupled dimensions (v16 §3), each of which must be stated even when the material fails it:

```text
WORLD MODEL → SYSTEMIC CONSEQUENCE → HUMAN MATERIALISATION
            → EXPERIENCE / STORY CAPACITY → MEMORY / TIME
```

The report is produced in 5 blocks — 13 LLM requests in total (1 + 4 + 3 + 3 + 2), because Blocks 2–5 are split into sub-requests to stay within free-plan timeout limits:

| Block | Name | v16 sections | Description |
|-------|------|--------------|-------------|
| **1** | Context and skeleton | §2, §4–6 | Audit mode (lazy / guided / material-aware), narrative engine, authorship hypothesis, world skeleton, 7-question fast screen |
| **2** | World mechanism | §7.1–7.12 | Possibility space, causal chains and reach, residue, pressure and displacement, coupling, ablation, perturbation, flow trace, geography, scale, macro–meso–micro continuity (4 chunks) |
| **3** | Epistemics and the human | §8–12 | Truth layers, information propagation and knowledge leakage, perspective divergence, random-passerby and biography tests, protagonist ablation, cultural integrity, characters, psychology (3 chunks) |
| **4** | Experience, story, theme | §13–17 | Human and reader surfaces, embodiment, humour and heartbreak, story capacity, thematic law, resolution integrity, narrative debt, medium fit, memorability and distinctiveness (3 chunks) |
| **5** | Root issues and recommendations | §18, §21–27 | Failure-mode classification, compressed root issues, up to 5 priority interventions, capability frontier, final verdict per §26.S (2 chunks) |

### Optional author framing: guided and material-aware modes

v16 §2 defines three audit modes; the default is `lazy` (only the concept is supplied). The form exposes the two richer modes as optional, collapsed sections:

- **Guided framing — «Рамки аудита» (optional).** Genre, target audience, target experience, non-negotiable pillars, known weaknesses and excluded questions. Filling any field switches the audit to `guided`: the framing changes section weighting and applicability, never the underlying causal standard, and a declared frame is still checked against the material rather than taken as proof. Empty fields are omitted, so an untouched form stays in `lazy` mode.
- **Additional materials — «Дополнительные материалы» (optional).** One or more artefacts, each with a short label and either pasted text or a loaded `.txt` / `.md` file. Two or more artefacts switch the audit to `material_aware`: each artefact is treated as a separate evidence layer, and disagreements between sources are reported instead of being silently reconciled. Rows without text are dropped on submit.

Both sections are optional and persist locally. Leaving them empty reproduces the default lazy audit. Exports record the framing: JSON carries the full input (`text`, `mediaType`, `guided`, `materials`), while Markdown and HTML include the guided fields and artefact labels with their text length (the artefact text itself is not duplicated).

### Evidence labels

Every finding carries an evidence label (§1.2) and a confidence word:

- `EXPLICIT` — established directly by the supplied material;
- `DERIVED` — follows from material facts through a shown mechanism;
- `INFERRED` — a plausible reading not directly shown;
- `HYPOTHESIS` — a working assumption to be tested;
- `UNKNOWN` — the material is silent; this is not a defect by itself (§1.7).

### Qualitative verdict (§26.S)

The report ends with seven diagnostic bands and a confidence word instead of a number:

```text
WORLD FOUNDATION:        weak / developing / coherent / strong
SYSTEMIC DEPTH:          weak / developing / coherent / strong
HUMAN INTEGRATION:       weak / developing / coherent / strong
EXPERIENTIAL INTEGRATION:weak / developing / coherent / strong
STORY CAPACITY:          narrow / focused / broad / highly generative
IDENTITY:                diffuse / emerging / distinct / highly distinct
OVERALL STATE:           fragile / viable / robust / unusually generative
CONFIDENCE:              high / mixed / low
```

These are diagnostic bands, not objective quality scores (§1.4, §26.S, §29). The UI never shows percentages, `X/52` counters or circular progress. When the material is too thin for a world skeleton, Block 1 marks it `FOUNDATION-LIMITED` and the fast-screen card shows a warning.

The capability frontier (§22) is always reported: demonstrated / under-proven / latent / new primitive required / experimental / deferred / contradicted or should-not-add.

### Pipeline Architecture

- **Sequential execution**: All 5 blocks always run to completion (no gate blocking)
- **Chunked requests**: Blocks 2–5 are split into sub-requests to stay within free-plan timeout limits
- **RPM-aware delay**: Configurable delay between chunks (based on RPM limit setting, minimum 1 second)
- **Single retry**: Transient errors (429, 502, 503) trigger one automatic retry with 5-second backoff
- **Partial-text recovery**: If a streaming request fails after receiving some text, the partial text is preserved
- **Non-blocking verdict extraction**: the machine-readable §27 JSON block is parsed after Block 5; if it is missing or invalid, the qualitative bands are recovered from the report markdown, so a verdict failure never breaks the audit
- **Block summaries as context**: each block emits a short weaknesses summary that is passed to the following blocks

### Exports

- **Markdown** — protocol identity, author framing (guided fields, artefact labels with text length), qualitative verdict table (bands, confidence, counts, frontier, closing statement), all five block markdowns, session metadata
- **JSON** — `protocol`, `input` (`text`, `mediaType`, plus `guided` / `materials` when supplied), `meta`, `orientationContext`, `verdict` (bands / issues / recommendations / frontier / closingStatement / source) and the five block markdowns
- **HTML** — printable single-file report with the same framing, verdict section and block content

No export contains a checklist score, a percentage or an `X/52` counter.

## Supported LLM Providers

| Provider | Auth Method | Default Model | Free Tier? |
|----------|-------------|---------------|------------|
| Z.AI | Bearer token | default | - |
| OpenAI | Bearer token | gpt-4.1-mini | - |
| Anthropic | x-api-key | claude-sonnet-4-6 | - |
| Google Gemini | Query string | gemini-2.5-flash | Yes |
| Mistral | Bearer token | mistral-large-latest | - |
| DeepSeek | Bearer token | deepseek-chat | - |
| Qwen | Bearer token | qwen-turbo | - |
| Kimi | Bearer token | moonshot-v1-8k | - |
| Groq | Bearer token | llama-3.3-70b-versatile | Yes |
| OpenRouter | Bearer token | anthropic/claude-sonnet-4 | Yes |
| HuggingFace | Bearer token | - | Yes |
| Together AI | Bearer token | - | Yes |
| xAI | Bearer token | grok-3-mini-fast | - |
| Custom | Bearer token | - | - |

> **Note**: Default models are synced with `src/lib/llm-client.ts` (`LLM_PROVIDERS`). If a model becomes deprecated, it is automatically migrated in `src/hooks/useSettings.ts` via rehydration logic.

## Architecture

```
Browser (Next.js Static SPA)
       |
       | fetch() with CORS
       v
Cloudflare Worker (CORS Proxy)
       |
       v
LLM Provider (OpenAI, Anthropic, Google, DeepSeek, etc.)
```

- **Frontend**: Next.js static SPA deployed on Cloudflare Pages
- **CORS Proxy**: Cloudflare Worker that handles provider-specific request transformations
- **State**: Browser localStorage via Zustand with `persist` middleware
- **No server, no database**: Everything runs client-side

## Tech Stack

- **Next.js 16** - React framework (static export)
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Zustand** - State management with localStorage persistence
- **Vitest** - Testing framework
- **Cloudflare Workers** - CORS proxy

---

<details>
<summary><strong>For Developers: Local Development & Deployment</strong></summary>

### Prerequisites

- Node.js 20+
- An LLM API key (OpenAI, Anthropic, Google, DeepSeek, etc.)

### Local Development

```bash
# Clone the repository
git clone https://github.com/vudirvp-sketch/universe-audit-protocol-webapp.git
cd universe-audit-protocol-webapp

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest run __tests__/audit/export-utils.test.ts
```

### Deploying the CORS Proxy Worker

```bash
cd worker
npm ci
npx wrangler login
npx wrangler deploy
```

Security configuration lives in [`worker/wrangler.toml`](./worker/wrangler.toml) `[vars]`:

- `ALLOWED_ORIGINS` — comma-separated browser origins allowed to call the proxy. Unset means the production Pages domain, its previews, and localhost:3000.
- `ALLOWED_CUSTOM_HOSTS` — comma-separated hostnames for `provider: "custom"`. Empty (default) disables custom endpoints on this proxy.

After deploying, verify the hardening:

```bash
curl -s https://<your-worker>.workers.dev/health           # expects "version":"v9"
curl -si -X OPTIONS https://<your-worker>.workers.dev/ -H "Origin: https://evil.example"  # expects 403
```

### Deploying the Frontend (Cloudflare Pages)

**Important**: This project uses `output: 'export'` in `next.config.ts`, which produces a fully static build in the `out/` directory. It must be deployed as **Cloudflare Pages** (static), NOT as a Cloudflare Worker.

**Option A: Cloudflare Dashboard (recommended)**

1. Go to Cloudflare Dashboard -> Workers & Pages -> Create -> Pages -> Connect to Git
2. Select the repository
3. Build settings:
   - Framework preset: **Next.js (Static Export)**
   - Build command: `npm run build`
   - Build output directory: `out`
   - **Do NOT use** `npx wrangler deploy` as the deploy command
4. Click **Save and Deploy**

**Option B: Wrangler CLI**

```bash
npm run build
npx wrangler pages deploy out --project-name=universe-audit-protocol
```

Or use the convenience script:
```bash
npm run deploy:pages
```

**Option C: GitHub Actions (automatic)**

Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Secrets, then push to `main`.

### Common Deployment Error

If you see this error:
```
Error: ENOENT: no such file or directory, open '.next/standalone/.next/server/pages-manifest.json'
```

It means Cloudflare is trying to deploy as a **Worker** (using OpenNext) instead of as a **Pages static site**. To fix:
1. In Cloudflare Dashboard, go to your Pages project settings
2. Ensure the framework preset is **Next.js (Static Export)**
3. Build output directory must be `out` (not `.next`)
4. The deploy command should NOT be `npx wrangler deploy`

</details>

## Language Contract

All LLM prompts are in Russian. JSON keys and enum values are in English. User-facing text is in Russian. Code comments are in English. This follows the protocol's language contract (v16 §1.9).

## Test Coverage

The test suite covers:

- **Export utilities**: protocol identity, verdict serialisation, five block markdowns, HTML escaping, absence of any score artefact
- **Error handler**: all `AuditErrorType` classifications, retry logic, Russian messages, abort handling
- **Streaming**: SSE line parsing, provider-specific delta extraction (OpenAI, Anthropic, Google)
- **Context bridge**: orientation extraction (audit mode, authorship hypothesis, skeleton, fast screen)
- **Pipeline**: sequential block execution, chunking, partial-text recovery

## Key Protocol Rules Implemented

| Rule | Description |
|------|-------------|
| v16 §1.2 Evidence discipline | Every claim carries an evidence label and a confidence word |
| v16 §1.4 No false precision | No numeric quality scores; qualitative bands only |
| v16 §1.7 Missing evidence ≠ missing feature | Silence of the material is not treated as a defect |
| v16 §5 Foundation rule | `FOUNDATION-LIMITED` when the material is too thin for a skeleton |
| v16 §22 Capability frontier | Mandatory seven-bucket frontier: more important than any checklist score |
| v16 §24 Do not double-count | Root problem → manifestations → affected levels |
| v16 §25 Recommendation priority | Maximum 5 interventions, classes LOCAL / CONNECTIVE / STRUCTURAL / EXPERIMENTAL |
| v16 §26.S Qualitative verdict | Seven diagnostic bands plus confidence, no percentages |

## License

MIT
