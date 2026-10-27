# Сборка, локальный запуск и публикация

## Требования

- **Node.js 22+** (см. `.nvmrc`; workflow использует ту же версию).
- Ключ API нужного провайдера — либо локальный рантайм вроде Ollama / LM Studio.

## Локальная разработка

```bash
git clone https://github.com/vudirvp-sketch/universe-audit-protocol-webapp.git
cd universe-audit-protocol-webapp
npm install
npm run dev
# http://localhost:3000
```

## Тесты и линт

```bash
npm test                                        # все 20 файлов
npm run test:coverage                           # с покрытием
npx vitest run __tests__/audit/export-utils.test.ts   # один файл
npm run lint
```

## Локальный запуск вообще без хостинга

```bash
npm install
npm run build     # статический экспорт в out/
npm run relay     # отдаёт out/ на http://127.0.0.1:8787
```

С переменной `LLM_API_KEY` (или `LLM_API_KEY_<PROVIDER>`) relay сам пересылает запросы провайдеру,
и браузер ключа не видит. Все запросы идут на `127.0.0.1`, поэтому CORS провайдера не важен.

```powershell
$env:LLM_API_KEY = 'sk-...'      # PowerShell
$env:LLM_API_KEY_OPENAI = 'sk-...'
npm run relay
```

```bash
LLM_API_KEY=sk-... npm run relay  # bash
```

## Публикация: только GitHub Pages

Единственный канал публикации. `.github/workflows/deploy.yml` на пуш в `main`:

1. ставит зависимости (`npm ci`),
2. собирает проект (`npm run build`),
3. прогоняет тесты (`npm test`) — **тесты гейтят публикацию**,
4. загружает `out/` как артефакт Pages,
5. публикует его через `deploy-pages`.

Сайт: **https://vudirvp-sketch.github.io/universe-audit-protocol-webapp/**

Источник Pages должен быть **GitHub Actions**, а не ветка: _Settings → Pages → Source: GitHub Actions_.
Ветка отдала бы неполную версию — собранный `out/` в репозитории не хранится.

### Про `NEXT_BASE_PATH`

Проектный сайт живёт на один уровень ниже корня домена, поэтому все URL ассетов должны начинаться
с `/universe-audit-protocol-webapp`. Workflow подставляет это значение только для пуша в `main`;
локальная сборка и relay остаются в корне. Если убрать переменную — на Pages отвалятся все `_next/*`.

### Про `.nojekyll`

Не нужен. При публикации через `upload-pages-artifact` Jekyll не запускается, файлы отдаются как есть;
живые `_next/static/*` отвечают 200. `.nojekyll` имеет смысл только для режима «Deploy from a branch».

### Про заголовки

GitHub Pages не умеет отдавать произвольные HTTP-заголовки, поэтому `public/_headers` (CSP и прочее)
на Pages игнорируется. Приложение работает и без них — теряется только дополнительный слой защиты.
Файл оставлен для хостов, которые его понимают.

## Других платформ нет

Vercel, Netlify, Cloudflare Workers и любой другой внешний хостинг в схеме публикации не участвуют.
Если в интерфейсе GitHub появится запись о деплое от стороннего приложения — это значит, что
приложение снова подключено к репозиторию, и его надо отключить.
