# Universe Audit Protocol v10.0

A comprehensive web application for auditing fictional worlds and narratives through a sequential AI-powered pipeline. Built on Cloudflare Pages (static SPA) + Cloudflare Worker (CORS proxy) architecture for zero-cost hosting.

## What it does

This tool analyzes narratives (novels, games, films, anime, series, TTRPGs) through a 12-step sequential pipeline with 4 hierarchical gate levels:

| Level | Question | Focus |
|-------|----------|-------|
| **L1 (Mechanism)** | "Does the world work as a system?" | Thematic law, root trauma, hamartia, emotional engine |
| **L2 (Body)** | "Is there embodiment and consequences?" | Pillars, prohibition, target experience, spatial memory |
| **L3 (Psyche)** | "Does the world work as a symptom?" | Grief architecture, dominant stage, hard check (≥2 levels) |
| **L4 (Meta)** | "Does it ask a question about the agent's real life?" | Three layers, cornelian dilemma, agent mirror, cult potential |

Each gate requires a mode-specific threshold score to proceed:
- **Conflict mode**: ≥60% per gate
- **Kishō mode**: ≥50% per gate
- **Hybrid mode**: ≥55% per gate

## Architecture

```
Browser (Next.js Static SPA)
       │
       │ fetch() with CORS
       ▼
Cloudflare Worker (CORS Proxy)
       │
       ▼
LLM Provider (OpenAI, Anthropic, Google, DeepSeek, etc.)
```

- **Frontend**: Next.js static SPA deployed on Cloudflare Pages
- **CORS Proxy**: Cloudflare Worker that handles provider-specific request transformations
- **State**: Browser localStorage via Zustand with `persist` middleware
- **No server, no database**: Everything runs client-side

## Pipeline Steps

| Step | Phase | Description | LLM? |
|------|-------|-------------|------|
| 0 | `input_validation` | Validate input (50–50,000 chars) | No |
| 1 | `mode_detection` | Detect audit mode (conflict/kishō/hybrid) | Yes |
| 2 | `author_profile` | Determine author's working method | Yes |
| 3 | `skeleton_extraction` | Extract structural elements (thematic law, root trauma, etc.) | Yes |
| 4 | `screening` | 7-question screening with count-based logic | Yes |
| 5 | `L1_evaluation` | Gate L1: Mechanism evaluation | Yes |
| 6 | `L2_evaluation` | Gate L2: Body evaluation | Yes |
| 7 | `L3_evaluation` | Gate L3: Psyche + Grief HARD CHECK | Yes |
| 8 | `L4_evaluation` | Gate L4: Meta + Cult Potential | Yes |
| 9 | `issue_generation` | Generate issues + "А чтобы что?" chains | Yes |
| 10 | `generative_modules` | Grief mapping (§9) + Dilemma (§12) | Yes |
| 11 | `final_output` | Compute final score + classification | No |

## Tech Stack

- **Next.js 16** — React framework (static export)
- **TypeScript** — Type safety
- **Tailwind CSS 4** — Styling
- **shadcn/ui** — UI components
- **Zustand** — State management with localStorage persistence
- **Vitest** — Testing framework
- **Cloudflare Workers** — CORS proxy

## Getting Started

### Prerequisites

- Node.js 20+
- An LLM API key (OpenAI, Anthropic, Google, DeepSeek, etc.)

### Installation

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

## Deployment

### Deploy the CORS Proxy (Cloudflare Worker)

```bash
cd worker
npm install
npx wrangler deploy
```

After deployment, note the Worker URL (e.g., `https://audit-proxy.your-subdomain.workers.dev`).

### Deploy the Frontend (Cloudflare Pages)

1. Push the repository to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com)
3. Create a new project, connect to the GitHub repo
4. Set build command: `npm run build`
5. Set output directory: `out`
6. Deploy

Alternatively, connect the GitHub repo directly to Cloudflare Pages via the dashboard.

### Configure in the App

1. Open the deployed app
2. Click the ⚙️ Settings button in the header
3. Select your LLM provider
4. Enter your API key
5. Enter the Worker proxy URL
6. Click Save

## Configuration

### Supported LLM Providers

| Provider | Auth Method | Default Model |
|----------|-------------|---------------|
| Z.AI | Bearer token | default |
| OpenAI | Bearer token | gpt-4o |
| Anthropic | x-api-key | claude-sonnet-4-20250514 |
| Google Gemini | Query string | gemini-2.0-flash |
| Mistral | Bearer token | mistral-large-latest |
| DeepSeek | Bearer token | deepseek-chat |
| Qwen | Bearer token | qwen-max |
| Kimi | Bearer token | moonshot-v1-128k |
| Groq | Bearer token | llama-3.3-70b-versatile |
| OpenRouter | Bearer token | openai/gpt-4o |
| HuggingFace | Bearer token | — |
| Together AI | Bearer token | — |
| xAI | Bearer token | grok-3 |
| Custom | Bearer token | — |

### Language Contract

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
- **Steps 5–8 (Gates)**: Mode-specific thresholds, Grief HARD CHECK (RULE_3), cult potential (Section 0.8)
- **Steps 9–11**: Issue/chain generation, generative modules, final score classification
- **Integration**: Step registry completeness, step order, interface compliance

## Key Protocol Rules Implemented

| Rule | Description |
|------|-------------|
| RULE_2 | "А чтобы что?" chain BREAK at step ≤4 = critical issue |
| RULE_3 | Grief HARD CHECK — dominant stage must have ≥2 levels |
| RULE_8 | Gate output always includes block-level breakdown |
| RULE_9 | ISSUE objects missing any field = invalid, regenerate |
| RULE_10 | Generative templates activate automatically when inputs absent |
| Section 0.6 | Count-based screening — code decides, not LLM |
| Section 0.7 | Mode-specific gate thresholds |
| Section 0.8 | Cult potential merged INTO L4 evaluation |

## License

MIT
