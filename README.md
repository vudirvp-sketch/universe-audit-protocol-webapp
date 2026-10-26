# Universe Audit Protocol v16

AI-powered tool for auditing fictional worlds and narratives through a 5-block sequential pipeline and five coupled audit dimensions. The verdict is qualitative: no numeric scores, no checklist percentages. There is no backend and no third-party proxy: the app is a static page, and the API calls happen on your machine.

The canonical specification is [`UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16`](./UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16) in the repository root.

## Quick Start

1. **Open the app** (any static hosting, or run it locally — see below).
2. **Click the gear icon** (Settings) in the header.
3. **Select your LLM provider** (Google Gemini, OpenRouter and DeepSeek work directly from the browser; Groq has a free tier via the relay).
4. **Choose how to connect**: «Напрямую из браузера» for CORS-capable providers, or «Локальный релей» for everything else.
5. **Enter your API key** (or leave it empty when the local relay runs with `LLM_API_KEY`).
6. **Click Save** — that's it.

## Connectivity: direct browser or local relay

Everything runs on the user's machine; there is no Cloudflare Worker, no account and no domain to register.

- **Direct** (default): the browser calls the provider API itself. Works for providers that send CORS headers — Google Gemini, Anthropic, OpenRouter, DeepSeek — and for local runtimes (Ollama, LM Studio) reachable on `localhost`. The key is attached in a header (`x-goog-api-key` for Gemini, `x-api-key` for Anthropic, Bearer elsewhere) and never goes through a third party.
- **Local relay** (optional): `node relay/relay.mjs` starts a small zero-dependency server on `127.0.0.1:8787`. It serves the built app and forwards `/api/llm` requests to the provider. Needed for providers that block browser CORS (OpenAI, Groq, Mistral, …), and it can hold the key itself (`LLM_API_KEY`), so the key never enters the browser at all.

```bash
npm run build          # static export in out/
npm run relay          # http://127.0.0.1:8787
# or, with the key kept out of the browser:
LLM_API_KEY=sk-... npm run relay
```

The relay only listens on loopback, pins `targetUrl` to the declared provider's API host, checks the `Host`/`Origin` headers (DNS-rebinding and foreign-site protections), and never logs keys or request bodies. See [`relay/README.md`](./relay/README.md).

## Security and API key handling

Where the key lives:

- **Default:** `localStorage` under `universe-audit-settings`, so it survives reloads and browser restarts. It is plaintext — anyone with access to the browser profile, a full-disk backup, or an extension with host permissions can read it.
- **Session-only:** enable «Не сохранять ключ на диск» in Settings. The key is then written to `sessionStorage` only (survives a reload of the tab, dies when the tab closes) and the `localStorage` entry stores `apiKey: null`.
- **Not in the browser at all:** run the local relay with `LLM_API_KEY` (or `LLM_API_KEY_<PROVIDER>`) and leave the field empty in Settings.

Where the key travels:

- **Direct mode:** browser → provider. The app's own code is the only intermediary.
- **Relay mode:** browser → `127.0.0.1` → provider. The key crosses only the loopback interface (or not at all, with `LLM_API_KEY`). The relay validates the relay URL client-side (https, or plain http only for loopback) and the provider base URL before anything is sent.

Residual risks worth knowing: a malicious browser extension, a compromised dependency, or disk access to the browser profile can still read a persisted key. Session-only mode and the env-key relay are the mitigations this app offers. Prompt-injected model output cannot exfiltrate the key: rendered report HTML is escaped and raw HTML from the model is not enabled.

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

| Provider | Browser (CORS) | Auth Method | Default Model | Free Tier? |
|----------|----------------|-------------|---------------|------------|
| Z.AI | unknown → relay | Bearer token | default | - |
| OpenAI | **no → relay** | Bearer token | gpt-4.1-mini | - |
| Anthropic | yes | x-api-key + `anthropic-dangerous-direct-browser-access` | claude-sonnet-4-6 | - |
| Google Gemini | yes | `x-goog-api-key` header | gemini-2.5-flash | Yes |
| Mistral | unknown → relay | Bearer token | mistral-large-latest | - |
| DeepSeek | yes | Bearer token | deepseek-chat | - |
| Qwen | unknown → relay | Bearer token | qwen-turbo | - |
| Kimi | unknown → relay | Bearer token | moonshot-v1-8k | - |
| Groq | unknown → relay | Bearer token | llama-3.3-70b-versatile | Yes |
| OpenRouter | yes | Bearer token | anthropic/claude-sonnet-4 | Yes |
| HuggingFace | unknown → relay | Bearer token | - | Yes |
| Together AI | unknown → relay | Bearer token | - | Yes |
| xAI | unknown → relay | Bearer token | grok-3-mini-fast | - |
| Custom / Ollama / LM Studio | depends on endpoint | Bearer token | - | - |

> **Note**: Default models are synced with `src/lib/llm-client.ts` (`LLM_PROVIDERS`). If a model becomes deprecated, it is automatically migrated in `src/hooks/useSettings.ts` via rehydration logic. "Unknown" CORS support means the UI warns you; if a direct call fails, switch the transport to the local relay. Local runtimes need CORS enabled on their side (`OLLAMA_ORIGINS`, LM Studio's CORS toggle).

## Architecture

```
Direct:  Browser (Next.js static SPA) ──fetch──> LLM provider
Relay:   Browser (Next.js static SPA) ──fetch──> node relay/relay.mjs (127.0.0.1)
                                               ──fetch──> LLM provider
```

- **Frontend**: Next.js static export — no server, no database; state in `localStorage` via Zustand `persist`
- **Local relay** (optional): zero-dependency Node script that serves the same static build and forwards `/api/llm`; it exists only to work around provider CORS and to keep the key out of the browser
- **No Cloudflare, no accounts, no domain**: the app itself is just static files

## Tech Stack

- **Next.js 16** - React framework (static export)
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - UI components
- **Zustand** - State management with localStorage persistence
- **Vitest** - Testing framework
- **Node.js** - Local relay only (`relay/relay.mjs`, no dependencies)

---

<details>
<summary><strong>For Developers: Local Development & Deployment</strong></summary>

### Prerequisites

- Node.js 22+
- An LLM API key for the provider you want to use (or a local Ollama / LM Studio endpoint)

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

### Run locally (no hosting at all)

```bash
npm install
npm run build      # static export in out/
npm run relay      # serves the app on http://127.0.0.1:8787
```

With `LLM_API_KEY` (or `LLM_API_KEY_<PROVIDER>`) in the environment, the relay forwards provider requests itself, and the browser never sees the key. All requests are same-origin to `127.0.0.1`, so provider CORS does not matter.

### Deploy as a static site (no domain needed)

Any static host works — the build output is plain files in `out/`:

- **GitHub Pages**: `.github/workflows/deploy.yml` builds, tests and deploys on every push to `main`. Enable it once in _Settings → Pages → Source: GitHub Actions_. The site appears at `https://<user>.github.io/<repo>/`, no custom domain. The workflow sets `NEXT_BASE_PATH=/<repo>` for the Pages build, because a project site is served one directory below the domain root; local builds and the relay stay at `/`. A run that failed before Pages was enabled has to be re-run (Actions → the run → "Re-run failed jobs") — the 404 means no deployment was ever created, not that the setting is wrong.
- **Netlify / Vercel (free)**: build command `npm run build`, publish directory `out`. Their free `*.netlify.app` / `*.vercel.app` subdomains need no domain registration.
- **Any static hosting** (S3, nginx, `python -m http.server`): upload `out/`.

When the page is served over https, direct browser calls work for CORS providers; the local relay is reachable at `http://127.0.0.1:8787` (localhost is exempt from mixed-content blocking).

**Limits of static hosting:** GitHub Pages cannot set custom HTTP headers, so `public/_headers` (CSP etc.) is honoured by Netlify and by any host that reads it, but ignored by GitHub Pages. The app still works there; only the extra defence-in-depth headers are lost.

</details>

## Language Contract

All LLM prompts are in Russian. JSON keys and enum values are in English. User-facing text is in Russian. Code comments are in English. This follows the protocol's language contract (v16 §1.9).

## Test Coverage

The test suite covers:

- **Export utilities**: protocol identity, verdict serialisation, five block markdowns, HTML escaping, absence of any score artefact
- **Error handler**: all `AuditErrorType` classifications, retry logic, Russian messages, abort handling
- **Streaming**: SSE line parsing, provider-specific delta extraction (OpenAI, Anthropic, Google), finish-reason normalisation, truncated streams
- **Context bridge / prompts**: orientation extraction, deterministic audit mode, material fencing
- **Pipeline**: sequential block execution, chunking, partial-text recovery
- **Local relay**: static serving, provider-host pinning, auth injection, Origin/Host guards, env-key override, body limits, no key in logs
- **Client security**: relay URL validation, provider auth headers, key custody (session-only storage)

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
