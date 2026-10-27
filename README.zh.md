# 宇宙审计协议

**虚构世界质量审计工具。** 产品名为俄语 «Протокол Аудита Вселенной»（宇宙审计协议）。界面与生成的报告均只有俄语版本，本页仅是面向中文读者的译本。它不做创意评估，也不是设定生成器：协议检查世界里什么是成立的、由此带来哪些系统性后果、这些后果在哪里变成某个人亲身经历的生活，以及最该先修什么。裁定是定性的：用七条诊断分带代替百分比和评分。Next.js 静态 SPA，没有后端——API 密钥留在你自己手里。

[**→ 打开应用**](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/) · 5 个区块 · 13 次请求 · 14 个服务商 · v3.1.0

[Русский](README.md) · [English](README.en.md) · **中文**

[![Deploy](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/actions/workflows/deploy.yml/badge.svg)](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/github/package-json/v/vudirvp-sketch/universe-audit-protocol-webapp)](package.json)
[![License](https://img.shields.io/github/license/vudirvp-sketch/universe-audit-protocol-webapp)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/vudirvp-sketch/universe-audit-protocol-webapp)](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/commits/main)
![语言](https://img.shields.io/badge/%E5%8D%8F%E8%AE%AE-%E4%B8%AD%E6%96%87-blue)

---

## 解决什么问题

常规的世界评论只回答“喜欢 / 不喜欢”，说不清构造到底在哪里撑不住。审计连续拆解三个层级：

- **世界不产生后果。** 声称“魔法有代价”，却看不到谁在付这个代价、世界因此改变了什么。解决办法是追踪因果链条，而不是继续堆细节。
- **后果存在，但和任何人都无关。** 系统在真空里运转：没有传记、没有日常、没有承受它的制度。解决办法是物质化——从世界的规则走到角色亲身经历的状态。
- **从内部看不出错误。** 世界“好像还行”，但不知道该修什么。解决办法是按固定维度做诊断：症状 → 根本原因 → 优先修改项。

协议按顺序走过这三个层级，并且**不给出任何数值评分**：用七条诊断分带和一个确定性词代替分数。

## 包含什么

报告由五个区块拼成。区块严格顺序执行，后一个只看到前一个压缩后的结论：

| # | 区块 | 协议章节 | 检查内容 |
|---|------|-------------------|---------------|
| **1** | 语境与骨架 | §2, §4–6 | 审计模式、叙事引擎、作者归属假设、世界骨架、7 个问题的快速筛查 |
| **2** | 世界机制 | §7.1–7.12 | 可能性空间、因果链条、剩余量、压力与偏移、连通性、消融、扰动 |
| **3** | 认识论与人 | §8–12 | 真理层级、信息传播与知识泄漏、视角分歧、主角消融、文化、心理 |
| **4** | 体验、故事、主题 | §13–17 | 人的表层、身体性、故事容量、主题法则、结局的完整性、与媒介的匹配 |
| **5** | 根本问题与建议 | §18, §21–27 | 失效分类、压缩后的根本问题、至多 5 项优先干预、可能性边界、最终裁定 |

对模型总共发起 **13 次请求**（1 + 4 + 3 + 3 + 2）：区块 2 到 5 被拆成多个部分，以便落进免费套餐的超时限制。被截断的回答由模型自己续写——每部分最多 2 次续写，并在区块标题里带上 `обрезано`（已截断）标记，这样不完整的章节永远不会看起来是完整的。

### 裁定

七条诊断分带加一个确定性词——没有百分比、没有 `X/52` 计数器、没有饼图：

```text
世界根基:                   弱 / 发展中 / 连贯 / 坚实
系统深度:                   弱 / 发展中 / 连贯 / 坚实
人的整合:                   弱 / 发展中 / 连贯 / 坚实
体验整合:                   弱 / 发展中 / 连贯 / 坚实
故事容量:                   窄 / 聚焦 / 宽广 / 生成性
同一性:                     模糊 / 初现 / 清晰 / 独特
总体状态:                   脆弱 / 可存续 / 稳固 / 异常生成性
确定性:                     高 / 混合 / 低
```
*界面与生成的报告均为俄语；此处仅为便于阅读而译为中文。*

这些是诊断分带，不是对质量的客观评分。每条发现都带一个证据标签——`EXPLICIT`、`DERIVED`、`INFERRED`、`HYPOTHESIS` 或 `UNKNOWN`——材料保持沉默本身不算缺陷。

### 三种审计模式

- **快速模式**（默认）——输入只有概念稿。
- **审计边界**（可选，界面中为 «Рамки аудита»）——体裁、受众、目标体验、不可动摇的支柱、已知弱点。边界改变各章节的权重，但不改变因果标准：声明的边界仍然要接受材料检验。
- **补充材料**（可选）——两个及以上的材料会变成独立的证据层，来源之间的分歧会被如实报告，而不是被抹平。

空字段会被省略，所以原封不动的表单复现的就是一次常规审计。

### 导出

Markdown、JSON 和可打印 HTML，各为单个文件。任何导出都不含分数、百分比或 `X/52` 计数器。

## 从哪里开始

1. **[打开应用](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/)**——无需安装，全部界面只有俄语。
2. **配置服务商**：页头的齿轮 → 服务商 → 接入方式 → API 密钥 → 保存。密钥只保存在你自己的浏览器里。
3. **粘贴概念稿**（至少 50 个字符），可选填媒介类型——叙事、游戏、视觉、桌面 RPG——然后点“开始审计”（«Начать аудит»）。
4. **边生成边看报告**。完整审计要跑几分钟，这是正常的；进度显示在流水线日志里，带计时器，每 10 秒一次心跳。

## 适合谁

- 为书籍、游戏和桌面 RPG 写设定、需要拆解构造而不是要一份点子清单的作者。
- 想按因果标准而不是读者口味来检验世界的人。
- 使用自己的模型或本地运行时、不愿把文本交给第三方的人。

如果你想找的是设定生成器或现成点子合集，**它并不适合**——这是检验工具，不是创作工具。

---

## 安全与 API 密钥

没有后端。密钥和审计文本不经过项目的任何服务器。

**密钥存放在哪里：**

- **默认**——放在浏览器的 `localStorage` 里。能挺过刷新，但以明文存放。
- **仅限当前会话**——在设置里打开“不将密钥保存到磁盘”（«Не сохранять ключ на диск»）：密钥进入 `sessionStorage`，随标签页一起消失。
- **完全不在浏览器里**——用环境变量 `LLM_API_KEY` 启动本地 relay；浏览器看不到密钥。

**密钥发往哪里：**

- **直接从浏览器发出**（默认）——应用自己调用服务商的 API。适用于支持 CORS 的服务商，以及 Ollama 之类的本地运行时。
- **经由本地 relay**（可选）——浏览器访问 `127.0.0.1:8787`，relay 把请求转给服务商。用于屏蔽浏览器请求的服务商。

**残余风险：**写入磁盘的密钥可能被恶意扩展读取，也可能被任何能访问浏览器配置文件的人读到。“仅限当前会话”模式和 relay 的 env 密钥，就是本工具针对这种情形给出的应对。注入到模型输出里的文本偷不走密钥：报告的 HTML 会被转义，来自模型的原始 HTML 已被禁用。

## 支持的服务商

| 服务商 | 可从浏览器直连（CORS） | 认证方式 | 默认模型 |
|-----------|--------------------|-------------|---------------------|
| Z.AI (GLM) | 是 | Bearer | glm-5.3 |
| OpenAI | 是 | Bearer | gpt-6.1-sol |
| Anthropic | 是，需 opt-in 请求头 | `x-api-key` | claude-sonnet-5.5 |
| Google Gemini | 是 | `x-goog-api-key` | gemini-3.8-flash |
| Mistral | 是 | Bearer | mistral-large-4-0 |
| DeepSeek | 是 | Bearer | deepseek-v4.1-flash |
| Qwen (intl) | 是 | Bearer | qwen3.8-max |
| Kimi (intl) | 是 | Bearer | kimi-k3.1-pro |
| Groq | 是 | Bearer | openai/gpt-oss-120b |
| OpenRouter | 是 | Bearer | anthropic/claude-sonnet-5.5 |
| HuggingFace | 经由 relay | Bearer | meta-llama/Llama-3.3-70B-Instruct |
| Together AI | 经由 relay | Bearer | deepseek-ai/DeepSeek-V4 |
| xAI | 是 | Bearer | grok-4.7 |
| Custom / Ollama / LM Studio | 取决于端点 | Bearer | — |

模型列表没有硬编码：设置页会从服务商的 `/models` 拉取最新目录，并缓存 24 小时。只有在请求无法发出时才使用内置列表——并且界面会说明数据来自哪里。

---

## 仓库

| 如果你是…… | 从这里开始 |
|----------|-------------|
| 只想直接使用 | [应用](https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/) |
| 想弄清审计为什么这样设计 | [`docs/protocol/UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16.md`](docs/protocol/UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16.md) |
| 想了解架构与流水线 | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| 担心密钥问题 | [`docs/SECURITY.md`](docs/SECURITY.md) |
| 想在本地构建并运行 | [命令](#命令) 和 [`docs/DEPLOY.md`](docs/DEPLOY.md) |
| 发现了错误 | [issues](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/issues) |

### 技术栈

Next.js 16（静态导出，单页）、React 19、TypeScript、Tailwind CSS 4、shadcn/ui 组件、用 Zustand 管理状态并持久化到 `localStorage`、Vitest 测试。没有服务器，也没有数据库——这是原则性选择，不是临时状态。

### 目录结构

| 路径 | 用途 |
|------|-----------|
| `src/app/` | 唯一的页面与 layout |
| `src/components/audit/` | 表单、报告、裁定卡片、流水线日志、设置 |
| `src/lib/audit/` | 流水线、协议提示词、裁定解析、导出、上下文桥 |
| `src/lib/llm-client.ts` | 服务商、流式、认证 |
| `src/lib/i18n/ru.ts` | 全部界面文案——唯一语言包 |
| `relay/relay.mjs` | 可选的本地服务器：静态文件与 API 代理 |
| `docs/protocol/` | 协议的正典文档 |
| `__tests__/` | 20 个文件，462 个用例 |
| `.github/workflows/deploy.yml` | 构建、测试并发布到 GitHub Pages |

### 命令

```bash
npm install            # 安装依赖（Node 22+）
npm run dev            # 开发服务器 http://localhost:3000
npm run build          # 静态导出到 out/
npm test               # 20 个测试文件，462 个用例
npm run lint           # eslint
npm run relay          # http://127.0.0.1:8787 —— 提供 out/ 并代理 API
npm run preview        # 一条命令完成 build + relay
```

### 无托管本地运行

```bash
npm run build
$env:LLM_API_KEY = 'sk-...'   # PowerShell；bash 中写作 LLM_API_KEY=sk-...
npm run relay
```

Relay 只监听 `127.0.0.1`，把 `targetUrl` 钉在所选服务商的主机上，校验 `Host`/`Origin` 请求头，并且从不把密钥或请求体写进日志。详见 [`relay/README.md`](relay/README.md)。

### 发布

唯一的发布渠道是 **GitHub Pages**，经由 `.github/workflows/deploy.yml`：向 `main` 推送时，workflow 会构建项目、跑测试并发布 `out/`。站点位于 `https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/`，`NEXT_BASE_PATH` 前缀只在构建 Pages 时注入。项目不使用其他任何发布平台。

### 演示

以下旧素材仍用于 Discord 上的 webhook：

- [视频演示](https://raw.githubusercontent.com/vudirvp-sketch/universe-audit-protocol-webapp/main/%D0%B4%D0%B5%D0%BC%D0%BE%D0%BD%D1%81%D1%82%D1%80%D0%B0%D1%86%D0%B8%D1%8F.mp4)
- [界面截图](https://raw.githubusercontent.com/vudirvp-sketch/universe-audit-protocol-webapp/main/Refiner-dpmpp_2m_sde-karras-1.0-40-0.9-2025-10-31%2017-17-44-0036.png)

用链接而不是内嵌：每个文件约 6 MB，作为 README 封面只会拖慢加载。

---

## 参与

欢迎提交 Issue 和 PR：[issues](https://github.com/vudirvp-sketch/universe-audit-protocol-webapp/issues)。提 PR 之前请跑 `npm test` 和 `npm run lint`——workflow 用测试作为发布的门槛。协议提示词放在 `src/lib/audit/prompts-v3.ts`，要跟 `docs/protocol/` 一起改——两者不一致会被视为缺陷。

## 许可证

[MIT](LICENSE)——可以使用、fork，也可以把片段拿进自己的项目。

## 关键词

世界审计 · 宇宙审计 · worldbuilding · 世界观构建 · 设定拆解 · 叙事分析 · 世界中的因果性 · 故事结构 · LLM · 提示词工程 · Next.js · 静态站点 · 俄语界面
