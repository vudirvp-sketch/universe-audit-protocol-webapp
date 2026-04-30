# Universe Audit Protocol v10.0

AI-powered tool for auditing fictional worlds and narratives through a 12-step sequential pipeline with 4 hierarchical gate levels. No deployment, no downloads — just open the link, enter your API key, and start analyzing.

## Quick Start

1. **Open the app**: [universe-audit-protocol.pages.dev](https://universe-audit-protocol.pages.dev)
2. **Click the gear icon** (Settings) in the header
3. **Select your LLM provider** (Google Gemini and Groq have free tiers!)
4. **Enter your API key**
5. **Click Save** — that's it!

The CORS proxy is pre-configured. You don't need to deploy anything.

## What it does

This tool analyzes narratives (novels, games, films, anime, series, TTRPGs) through a 12-step sequential pipeline with 4 hierarchical gate levels:

| Level | Question | Focus |
|-------|----------|-------|
| **L1 (Mechanism)** | "Does the world work as a system?" | Thematic law, root trauma, hamartia, emotional engine |
| **L2 (Body)** | "Is there embodiment and consequences?" | Pillars, prohibition, target experience, spatial memory |
| **L3 (Psyche)** | "Does the world work as a symptom?" | Grief architecture, dominant stage, hard check (>=2 levels) |
| **L4 (Meta)** | "Does it ask a question about the agent's real life?" | Three layers, cornelian dilemma, agent mirror, cult potential |

Each gate requires a mode-specific threshold score to proceed:
- **Conflict mode**: >=60% per gate
- **Kisho mode**: >=50% per gate
- **Hybrid mode**: >=55% per gate

## Supported LLM Providers

| Provider | Auth Method | Default Model | Free Tier? |
|----------|-------------|---------------|------------|
| Z.AI | Bearer token | default | - |
| OpenAI | Bearer token | gpt-4o-mini | - |
| Anthropic | x-api-key | claude-3-5-sonnet-20241022 | - |
| Google Gemini | Query string | gemini-2.0-flash | Yes |
| Mistral | Bearer token | mistral-large-latest | - |
| DeepSeek | Bearer token | deepseek-chat | - |
| Qwen | Bearer token | qwen-turbo | - |
| Kimi | Bearer token | moonshot-v1-8k | - |
| Groq | Bearer token | llama-3.3-70b-versatile | Yes |
| OpenRouter | Bearer token | anthropic/claude-3.5-sonnet | Yes |
| HuggingFace | Bearer token | - | Yes |
| Together AI | Bearer token | - | Yes |
| xAI | Bearer token | grok-beta | - |
| Custom | Bearer token | - | - |

## Pipeline Steps

| Step | Phase | Description | LLM? |
|------|-------|-------------|------|
| 0 | `input_validation` | Validate input (50-50,000 chars) | No |
| 1 | `mode_detection` | Detect audit mode (conflict/kisho/hybrid) | Yes |
| 2 | `author_profile` | Determine author's working method | Yes |
| 3 | `skeleton_extraction` | Extract structural elements (thematic law, root trauma, etc.) | Yes |
| 4 | `screening` | 7-question screening with count-based logic | Yes |
| 5 | `L1_evaluation` | Gate L1: Mechanism evaluation | Yes |
| 6 | `L2_evaluation` | Gate L2: Body evaluation | Yes |
| 7 | `L3_evaluation` | Gate L3: Psyche + Grief HARD CHECK | Yes |
| 8 | `L4_evaluation` | Gate L4: Meta + Cult Potential | Yes |
| 9 | `issue_generation` | Generate issues + "A chtoby chto?" chains | Yes |
| 10 | `generative_modules` | Grief mapping (S9) + Dilemma (S12) | Yes |
| 11 | `final_output` | Compute final score + classification | No |

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
npx vitest run __tests__/audit/json-sanitizer.test.ts
```

### Deploying the CORS Proxy Worker

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
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

All LLM prompts are in Russian. JSON keys and enum values are in English. User-facing text is in Russian. Code comments are in English. This follows the protocol's language contract (Section 0.5).

## Test Coverage

The test suite covers 267 tests across:

- **JSON sanitizer**: Balanced-brace extraction, markdown fences, edge cases
- **Error handler**: All 8 `AuditErrorType` classifications, retry logic, Russian messages
- **Step 0 (Validation)**: Input length bounds, gateCheck blocking, skipLLM pattern
- **Step 1 (Mode Detection)**: Mode parsing, validation, default fallbacks
- **Step 2 (Author Profile)**: Profile types, answer parsing, reduce state
- **Step 3 (Skeleton)**: Complete/incomplete extraction, gateCheck blocking on missing elements
- **Step 4 (Screening)**: Count-based recommendation (Section 0.6), LLM override, gate blocking
- **Steps 5-8 (Gates)**: Mode-specific thresholds, Grief HARD CHECK (RULE_3), cult potential (Section 0.8)
- **Steps 9-11**: Issue/chain generation, generative modules, final score classification
- **Integration**: Step registry completeness, step order, interface compliance

## Key Protocol Rules Implemented

| Rule | Description |
|------|-------------|
| RULE_2 | "A chtoby chto?" chain BREAK at step <=4 = critical issue |
| RULE_3 | Grief HARD CHECK - dominant stage must have >=2 levels |
| RULE_8 | Gate output always includes block-level breakdown |
| RULE_9 | ISSUE objects missing any field = invalid, regenerate |
| RULE_10 | Generative templates activate automatically when inputs absent |
| Section 0.6 | Count-based screening - code decides, not LLM |
| Section 0.7 | Mode-specific gate thresholds |
| Section 0.8 | Cult potential merged INTO L4 evaluation |

## License

MIT
