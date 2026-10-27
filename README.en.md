# Universe Audit Protocol

**Universe Audit Protocol («Протокол Аудита Вселенной») is an instrument for the qualitative audit of fictional worlds.** It is not an idea review and not a lore generator: the protocol checks what is true in a world, what systemic consequences that has, where those consequences turn into someone's lived experience — and what to fix first. The verdict is qualitative: seven diagnostic bands instead of percentages and scores. The interface and the generated report are in Russian. A static SPA on Next.js, with no backend — the API key stays with you.

[**→ Open the app**](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/) · 5 blocks · 13 requests · 14 providers · v3.1.0

[Русский](README.md) · **English** · [中文](README.zh.md)

[![Deploy](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/actions/workflows/deploy.yml/badge.svg)](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/github/package-json/v/vudirvp-sketch/universe-audit-protocol-webapp)](package.json)
[![License](https://img.shields.io/github/license/vudirvp-sketch/universe-audit-protocol-webapp)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/vudirvp-sketch/universe-audit-protocol-webapp)](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/commits/main)
![Language](https://img.shields.io/badge/protocol-english-blue)

---

## What problem this solves

Ordinary criticism of a world answers "like it / don't like it" and says nothing about where exactly the construction fails to carry weight. The audit works through three levels in sequence:

- **The world generates no consequences.** "Magic has a price" is declared, but nowhere is it visible who pays that price and what changes. The cure is tracing the causal chain, not adding detail.
- **Consequences exist, but touch no one.** The system runs in a vacuum: there are no biographies, no ordinary life, no institutions that outlive it. The cure is materialization — from a rule of the world to a lived state of a character.
- **The error is not visible from inside.** The world "seems fine", but it is unclear what to repair. The cure is diagnostics by fixed dimensions: symptom → root cause → priority fix.

The protocol walks these levels in sequence and **gives no numeric scores**: instead of points, seven diagnostic bands and a confidence word.

## What is inside

The report is assembled from five blocks. The blocks run strictly in sequence; each next one sees the condensed conclusions of the previous:

| # | Block | Protocol sections | What it checks |
|---|-------|-------------------|----------------|
| **1** | Context and skeleton | §2, §4–6 | Audit mode, narrative engine, authorship hypothesis, world skeleton, quick screen of 7 questions |
| **2** | World mechanics | §7.1–7.12 | Possibility space, causal chains, residue, pressure and displacement, coherence, ablation, perturbation |
| **3** | Epistemics and the human | §8–12 | Truth layers, information spread and knowledge leakage, divergence of perspectives, protagonist ablation, culture, psychology |
| **4** | Experience, story, theme | §13–17 | Human surface, embodiment, story capacity, thematic law, integrity of the resolution, fit to the medium |
| **5** | Root problems and recommendations | §18, §21–27 | Failure classification, condensed root problems, up to 5 priority interventions, the boundary of the possible, final verdict |

In total, **13 requests** to the model (1 + 4 + 3 + 3 + 2): blocks 2–5 are split into parts so that they fit inside free-tier timeouts. The model finishes a truncated answer itself — up to two continuations per part, with the `обрезано` ("truncated") marker in the block heading, so that an incomplete section never looks complete.

### The verdict

Seven diagnostic bands plus a confidence word — no percentages, no `X/52` counters, no pie charts:

```text
WORLD FOUNDATION:         weak / developing / coherent / strong
SYSTEMIC DEPTH:           weak / developing / coherent / strong
HUMAN INTEGRATION:        weak / developing / coherent / strong
EXPERIENTIAL INTEGRATION: weak / developing / coherent / strong
STORY CAPACITY:           narrow / focused / broad / generative
IDENTITY:                 diffuse / emerging / distinct / unique
OVERALL CONDITION:        fragile / viable / robust / exceptionally generative
CONFIDENCE:               high / mixed / low
```
*The interface and the generated report are in Russian; band names are translated here for readability.*

These are diagnostic bands, not an objective quality score. Every finding carries an evidence label — `EXPLICIT`, `DERIVED`, `INFERRED`, `HYPOTHESIS` or `UNKNOWN` — and silence in the material is not counted as a defect by itself.

### Three audit modes

- **Quick** («Быстрый», default) — the only input is the concept.
- **Audit frame** («Рамки аудита», optional) — genre, audience, target experience, inviolable pillars, known weaknesses. A frame changes the weights of the sections, but not the causal standard: a declared frame is still checked against the material.
- **Additional materials** («Дополнительные материалы», optional) — two or more artifacts turn into separate evidence layers, and disagreements between sources are reported, not smoothed over.

Empty fields are omitted, so an untouched form reproduces the ordinary audit.

### Export

Markdown, JSON and printable HTML as a single file. No export contains scores, percentages or the `X/52` counter.

## Where to start

1. **[Open the app](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/)** — nothing is installed, the entire interface is in Russian.
2. **Set up a provider**: the gear in the header → provider → connection method → API key → save. The key is stored only in your browser.
3. **Paste the concept** (minimum 50 characters), optionally pick the media type — narrative, game, visual, tabletop RPG — and press "Start audit" («Начать аудит»).
4. **Watch the report** as it arrives. A full audit takes minutes: that is normal; progress is visible in the pipeline log with timers and a heartbeat every 10 seconds.

## Who it suits

- Authors of settings for books, games and tabletop RPGs who need an analysis of the construction, not a list of ideas.
- Those who want to check a world by a causal standard, not by the reader's taste.
- Those who work with their own model or a local runtime and do not want to hand the text to third parties.

**Not a fit** if what you need is a lore generator or a collection of ready-made ideas — this is an instrument of verification, not of invention.

---

## Security and the API key

There is no backend. The key and the audit text pass through no server of this project.

**Where the key lives:**

- **By default** — in the browser's `localStorage`. It survives a reload, but it sits there in plain text.
- **Session only** — enable "Don't save the key to disk" («Не сохранять ключ на диск») in the settings: the key goes to `sessionStorage` and dies with the tab.
- **Not in the browser at all** — run a local relay with the `LLM_API_KEY` environment variable; the browser never sees the key.

**Where it goes:**

- **Straight from the browser** (default) — the app calls the provider's API itself. Works for providers with CORS and for local runtimes such as Ollama.
- **Through a local relay** (optional) — the browser talks to `127.0.0.1:8787`, and the relay forwards the request to the provider. Needed for providers that block browser requests.

**Residual risks:** a key saved to disk can be read by a malicious extension or by anyone with access to the browser profile. Session-only mode and the relay env key are what the tool offers against that scenario. Text injected into the model's output cannot steal the key: the report's HTML is escaped, and raw HTML from the model is disabled.

## Supported providers

| Provider | From the browser (CORS) | Authorization | Default model |
|----------|-------------------------|---------------|---------------|
| Z.AI (GLM) | yes | Bearer | glm-5.3 |
| OpenAI | yes | Bearer | gpt-6.1-sol |
| Anthropic | yes, with an opt-in header | `x-api-key` | claude-sonnet-5.5 |
| Google Gemini | yes | `x-goog-api-key` | gemini-3.8-flash |
| Mistral | yes | Bearer | mistral-large-4-0 |
| DeepSeek | yes | Bearer | deepseek-v4.1-flash |
| Qwen (intl) | yes | Bearer | qwen3.8-max |
| Kimi (intl) | yes | Bearer | kimi-k3.1-pro |
| Groq | yes | Bearer | openai/gpt-oss-120b |
| OpenRouter | yes | Bearer | anthropic/claude-sonnet-5.5 |
| HuggingFace | via relay | Bearer | meta-llama/Llama-3.3-70B-Instruct |
| Together AI | via relay | Bearer | deepseek-ai/DeepSeek-V4 |
| xAI | yes | Bearer | grok-4.7 |
| Custom / Ollama / LM Studio | depends on the endpoint | Bearer | — |

The model list is not hardcoded: the settings pull the provider's current catalog from its `/models` and cache it for 24 hours. The built-in list is used only when the request is impossible — and the interface says where the data came from.

---

## Repository

| If you… | Start here |
|---------|------------|
| just want to use it | [the app](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/) |
| want to understand why the audit is built this way | [`docs/protocol/UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16.md`](docs/protocol/UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16.md) |
| want to understand the architecture and the pipeline | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| are worried about the key | [`docs/SECURITY.md`](docs/SECURITY.md) |
| want to build and run it locally | [Commands](#commands) and [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| found a bug | [issues](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/issues) |

### Stack

Next.js 16 (static export, one page), React 19, TypeScript, Tailwind CSS 4, shadcn/ui components, Zustand state persisted to `localStorage`, Vitest tests. There is no server and no database — by principle, not temporarily.

### Structure

| Path | Purpose |
|------|---------|
| `src/app/` | the single page and the layout |
| `src/components/audit/` | form, report, verdict card, pipeline log, settings |
| `src/lib/audit/` | pipeline, protocol prompts, verdict parsing, export, context bridge |
| `src/lib/llm-client.ts` | providers, streaming, authorization |
| `src/lib/i18n/ru.ts` | every interface string — the single locale |
| `relay/relay.mjs` | optional local server: static files and the API proxy |
| `docs/protocol/` | the canonical protocol document |
| `__tests__/` | 20 files, 462 cases |
| `.github/workflows/deploy.yml` | build, tests and publishing to GitHub Pages |

### Commands

```bash
npm install            # dependencies (Node 22+)
npm run dev            # dev server on http://localhost:3000
npm run build          # static export into out/
npm test               # 20 test files, 462 cases
npm run lint           # eslint
npm run relay          # http://127.0.0.1:8787 — serves out/ and proxies the API
npm run preview        # build + relay in one command
```

### Running locally without hosting

```bash
npm run build
$env:LLM_API_KEY = 'sk-...'   # PowerShell; in bash — LLM_API_KEY=sk-...
npm run relay
```

The relay listens only on `127.0.0.1`, pins `targetUrl` to the declared provider's host, checks the `Host`/`Origin` headers and never writes keys or request bodies to the log. Details — [`relay/README.md`](relay/README.md).

### Publishing

The only channel is **GitHub Pages** through `.github/workflows/deploy.yml`: on a push to `main` the workflow builds the project, runs the tests and publishes `out/`. The site lives at `https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/`; the `NEXT_BASE_PATH` prefix is substituted only for the Pages build. The project uses no other publishing platform.

### Demo

Older recordings that are used in a Discord webhook:

- [video demo](https://raw.githubusercontent.com/vudirvp-sketch/universe-audit-protocol-webapp/main/%D0%B4%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F.mp4)
- [interface screenshot](https://raw.githubusercontent.com/vudirvp-sketch/universe-audit-protocol-webapp/main/Refiner-dpmpp_2m_sde-karras-1.0-40-0.9-2025-10-31%2017-17-44-0036.png)

Links, not embeds: the files weigh ~6 MB each, and as a README cover they would only slow the page down.

---

## Contributing

Issues and PRs are welcome: [issues](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/issues). Before a PR, run `npm test` and `npm run lint` — the workflow gates publishing on the tests. The protocol prompts live in `src/lib/audit/prompts-v3.ts` and change together with `docs/protocol/` — a divergence between them counts as a defect.

## License

[MIT](LICENSE) — you can use it, fork it and take pieces into your own projects.

## Keywords

world audit · universe audit · worldbuilding · setting analysis · narrative analysis · causality in a world · story structure · LLM · prompt engineering · Next.js · static site · Russian interface
