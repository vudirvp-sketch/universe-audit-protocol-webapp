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
