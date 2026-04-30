# План исправлений — Часть 1

## Файлы, которые были исправлены

### 1. `src/lib/audit/types.ts`
- **Удалён `self_audit` из AuditPhase** — не является отдельным шагом конвейера (Section 0.8 COMPLETION_PLAN)
- **Переименован дублирующийся `ValidationResult`** → `StepValidationResult` (для AuditStep lifecycle) и `InputValidationResult` (для полного результата валидации ввода). Старый `ValidationResult` из `input-validator.ts` не тронут — он локальный
- **Добавлен `ScreeningRecommendation`** type: `'ready_for_audit' | 'requires_sections' | 'stop_return_to_skeleton'`
- **Добавлен `GateThresholds`** interface и `DEFAULT_THRESHOLDS` constant (Section 0.7)
- **Добавлена функция `getGateThreshold(mode, level)`** — возвращает порог для режима и уровня

### 2. `src/lib/audit/prompts.ts`
- **ПОЛНОСТЬЮ переписан на русский** per Language Contract (Section 0.5):
  - Системный промпт: русский
  - Пользовательские промпты: русский
  - JSON ключи в выводе: английский
  - JSON значения: русский
  - Enum значения: английский
- **Добавлена обёртка `<user_input>`** через `wrapUserInput(sanitizeNarrative(narrative))` для защиты от prompt injection (Section 2.3)
- **Добавлена инструкция weakness test на русском**: «Проведи анализ слабостей на русском языке»

### 3. `src/lib/audit/modes.ts`
- **MODE_LABELS** → русские: 'КОНФЛИКТ — Режим канонического разрешения', 'КИРЁ — Режим уточнения у автора', 'ГИБРИД — Комбинированный режим'
- **MODE_DESCRIPTIONS** → русские описания

### 4. `src/lib/audit/orchestrator.ts`
- **`executeGateWithBreakdown`** теперь принимает `mode: AuditMode` вместо хардкода `threshold: number`
- Пороги берутся через `getGateThreshold()` из types.ts (Section 0.7)
- **AuditSection content** → русские описания ('Анализ структуры', 'Валидация тематического закона', etc.)
- Добавлен `import { getGateThreshold } from './types'`

### 5. `src/lib/audit/pipeline.ts`
- **Удалён `self_audit`** из canonical AuditPhase list

### 6. `package.json`
- **Добавлен `rehype-sanitize: ^6.0.0`** — Required для XSS-защиты при рендеринге LLM output (Finding 19)

## Файл, который нужно УДАЛИТЬ

### `src/lib/security.ts`
Серверный dead code — нет API роутов, нет next-auth, нет серверного рантайма (static SPA).
Функции `extractApiKey`, `getClientIdentifier`, `checkRateLimit` ссылаются на `Request` — это серверный API.
Функция `sanitizeNarrative` дублируется в `src/lib/audit/input-sanitizer.ts`.
Функция `validateApiKeyFormat` дублируется в `src/lib/llm-client.ts::validateApiKey`.

**Команда для удаления:**
```bash
rm src/lib/security.ts
```

---

## Часть 2 — Актуализация деплоя (2026-05-01)

### Выполненные действия

#### 1. Развертывание Cloudflare Pages
- Создан проект `universe-audit-protocol` в Cloudflare Pages
- URL: https://universe-audit-protocol.pages.dev
- Выполнен первый деплой через `wrangler pages deploy out`

#### 2. Развертывание Cloudflare Worker (CORS Proxy)
- Worker `universe-audit-proxy` уже был развёрнут ранее
- URL: https://universe-audit-proxy.vudirvp.workers.dev
- Подтверждена работоспособность (тестовый запрос возвращает ответ от OpenAI API)

#### 3. Обновление `worker/wrangler.toml`
- Заменён placeholder-комментарий на актуальные данные:
  - Workers subdomain: `vudirvp`
  - Worker URL: `https://universe-audit-proxy.vudirvp.workers.dev`
  - Account ID: `5a7a04ab064205a1f901ebdb7b40dcc0`
- Исправлен route pattern: `audit-proxy.vudirvp` → `universe-audit-proxy.vudirvp`

#### 4. Обновление `src/hooks/useSettings.ts`
- Заменён `DEFAULT_PROXY_URL` с placeholder `https://audit-proxy.<your-subdomain>.workers.dev`
  на реальный URL: `https://universe-audit-proxy.vudirvp.workers.dev`
- Новый пользователь получит рабочий URL прокси по умолчанию
- Существующие пользователи: если в localStorage сохранён placeholder, он остаётся —
  нужно очистить настройки и сохранить заново

#### 5. Обновление `README.md`
- Полностью переписан раздел **Deployment** с актуальными шагами:
  - Step 1: Создание API Token (с точными названиями кнопок в интерфейсе Cloudflare 2024/2025)
  - Step 2: Настройка GitHub Secrets
  - Step 3: Деплой Worker через Wrangler CLI
  - Step 4: Деплой Pages (3 варианта: GitHub Actions, Wrangler CLI, Dashboard)
  - Step 5: Настройка в приложении
- Добавлены текущие URL деплоя

#### 6. Обновление `worker/README.md`
- Добавлены актуальные данные деплоя (URL, Account ID)
- Добавлен вариант деплоя через переменные окружения (CI/CD)

#### 7. Обновление `.github/workflows/deploy.yml`
- Переименован: `Deploy to Cloudflare Pages` → `Deploy to Cloudflare`
- Добавлен job `deploy-worker` для автоматического деплоя CORS Proxy Worker
- Добавлен `npm test` в job `build` перед деплоем
- Деплой Pages и Worker выполняются параллельно после сборки

---

## Часть 3 — Исправление 429 Rate Limit и React Error #185 (2026-05-01)

### Проблема
На https://universe-audit-protocol.pages.dev при запуске аудита:
1. **429 Rate Limit** — Z.AI free tier имеет лимит ~3 RPM, Worker прокидывал 429 без retry
2. **React Error #185** — state-обновления из async catch-блоков конфликтовали с render-циклом React, persisted failed-состояние вызывало краш при перезагрузке

### Выполненные действия

#### 1. `worker/cors-proxy.js` — Server-side 429 retry
- Добавлена функция `fetchWith429Retry()`: 2 автоматические попытки при 429 с backoff (3с, 9с)
- При 429 ответе добавляется заголовок `X-Proxy-Retried: N` — клиент знает, что прокси уже пробовал
- Максимальное время ожидания: 12с (в рамках 30с таймаута Worker)
- Упрощён `wrangler.toml`: убраны routes (workers.dev маршрутизируется автоматически)

#### 2. `src/lib/llm-client.ts` — Улучшенный client-side retry
- Увеличен exponential backoff: 10с/30с/60с (вместо 5с/15с/45с)
- Чтение заголовка `X-Proxy-Retried` — клиент знает, что прокси уже делал retry
- Улучшены сообщения об ошибках: конкретные рекомендации на русском (подождать, уменьшить RPM, сменить провайдера)

#### 3. `src/components/ErrorBoundary.tsx` — Новый компонент
- React ErrorBoundary для перехвата ошибок рендеринга
- Показывает понятное сообщение на русском с кнопкой перезагрузки
- Очищает persisted state при reset через `localStorage.removeItem`

#### 4. `src/app/page.tsx` — Защита от React Error #185
- Обёрнут в `<ErrorBoundary>`
- State-обновления в catch-блоках отложены через `queueMicrotask()` — предотвращает конфликт с render-циклом

#### 5. `src/hooks/useAuditState.ts` — Автосброс terminal-состояний
- Добавлен `onRehydrateStorage`: при загрузке страницы состояния `failed/blocked/cancelled` автоматически сбрасываются в `idle`
- Предотвращает краш при перезагрузке страницы после ошибки

#### 6. `src/hooks/useSettings.ts` — RPM лимит
- Z.AI RPM default уменьшен с 10 до 3 — реалистичный лимит для free tier

#### 7. Деплой
- Worker переделоен: `https://universe-audit-proxy.vudirvp.workers.dev`
- Pages переделоен: `https://universe-audit-protocol.pages.dev`
- Новый API-токен: `cfut_AKGsvO2ZV5wETLJV0bCh155qZxEJ6DNP1gCVuQGI84e2366a`
