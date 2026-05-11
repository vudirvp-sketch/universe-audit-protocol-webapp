/**
 * Centralized Russian strings for the Universe Audit Protocol v3.
 * All user-facing text is defined here as a flat const object.
 *
 * Language Contract (Section 0.5):
 * - UI text: Russian
 * - JSON keys in LLM output: English
 * - JSON values in LLM output: Russian
 * - Enum values: English (displayed as-is in badges)
 *
 * v3: 5-block pipeline, free-form markdown output.
 * Legacy v2 keys (3-step pipeline, structured cards) removed.
 *
 * Synchronised with АУДИТ_ВСЕЛЕННОЙ v10.0 terminology.
 */

export const t = {
  app: {
    title: 'Протокол Аудита Вселенной',
    version: 'v3.1',
    subtitle: 'Анализ вымышленных миров через 4 иерархических уровня (v10.0)',
    description:
      'Протокол Аудита Вселенной оценивает вымышленные миры через 4 иерархических уровня: Механизм, Тело, Психика и Мета. Введите описание вашего мира — и протокол выявит слабости, предложит исправления и оценит культовый потенциал.',
    footer:
      'Протокол Аудита Вселенной v3.1 — 5 блоков, 4 уровня, full v10.0 diagnostics',
    footerStats: '4 уровня \u2022 5 блоков \u2022 v10.0 diagnostics',
    newAudit: 'Новый аудит',
    cancelAudit: 'Отменить аудит',
    startAudit: 'Начать аудит',
    analyzing: 'Анализируем...',
    clear: 'Очистить',
    save: 'Сохранить',
    saved: 'Сохранено!',
    settings: 'Настройки',
    criteriaCount: '5 блоков',
    block1Label: 'Ориентация',
    block2Label: 'Механизм (L1)',
    block3Label: 'Тело + Психика (L2+L3)',
    block4Label: 'Мета (L4)',
    block5Label: 'Синтез + Рекомендации',
    exportMD: 'Скачать MD',
    exportJSON: 'Скачать JSON',
    copyToClipboard: 'Копировать',
    streamingInProgress: 'Генерация ответа...',
    verdictStrong: 'Сильный',
    verdictWeak: 'Слабый',
    verdictInsufficientData: 'Недостаточно данных',
    apiKeyInvalid: 'API-ключ не прошёл валидацию',
    inputHint: 'Введите концепт — от пары предложений до целого рассказа. Длинные тексты обрабатываются автоматически.',
  },

  form: {
    narrativeTitle: 'Ввод нарратива',
    narrativeDescription:
      'Введите концепт, структуру истории или описание мира для анализа',
    narrativeLabel: 'Нарратив / Текст концепта',
    narrativePlaceholder:
      'Введите концепт вашего нарратива, структуру истории или описание мира здесь...\n\nПример: Постапокалиптический мир, где воспоминания можно извлекать и продавать. Протагонист — торговец памятью — обнаруживает, что его собственные воспоминания были систематически стёрты, что ведёт его в путешествие за восстановлением прошлого, пока он раскрывает заговор, угрожающий тому, что осталось от общества...',
    characterCount: '{count} символов | Минимум 100 символов рекомендуется',
    mediaType: 'Тип медиа',
    mediaTypeSelect: 'Выберите тип медиа',
    mediaNarrative: 'Нарратив',
    mediaGame: 'Игра',
    mediaVisual: 'Визуальное',
    mediaTtrpg: 'ТВРПГ',
    minCharsWarning: 'Минимум 50 символов для запуска аудита',
    uploadFile: 'Загрузить файл',
    supportedFormats: 'Поддерживаемые форматы: .txt, .md, .docx, .pdf',
    fileUploaded: 'Файл загружен: {name} ({size} символов)',
    fileReadError: 'Ошибка чтения файла',
  },

  // v3: 5-блочный пайплайн
  phases: {
    idle: 'Готов',
    block1: 'Ориентация',
    block2: 'Механизм (L1)',
    block3: 'Тело + Психика (L2+L3)',
    block4: 'Мета (L4)',
    block5: 'Синтез + Рекомендации',
    complete: 'Завершено',
    failed: 'Ошибка',
    cancelled: 'Отменено',
  },

  phaseDescriptions: {
    idle: 'Введите нарратив для начала',
    block1: 'Определение режима аудита (Conflict / Kishō / Гибрид), профиля автора (Садовник / Архитектор), скелета концепта (8 элементов) и быстрого скрининга (7 проверок)',
    block2: 'Аудит механизма: MDA+OT, 17 критериев живого мира, связанность, экономическая стрела, тест «А чтобы что?» (L1)',
    block3: 'Аудит тела и психики: 5 слоёв персонажа, гамартия, тест Мэри Сью, тест Сандерсона, Архитектура Горя × 4 уровня (L2+L3)',
    block4: 'Аудит мета-уровня: три слоя реальности, Корнелианская дилемма, этика авторства, зеркало агента, мисдирекшн, нарративный долг (L4)',
    block5: 'Синтез: дерево решений для патчей, приоритизированные рекомендации и итоговый вердикт (X/52)',
    complete: 'Аудит завершён',
    failed: 'Ошибка при выполнении аудита',
    cancelled: 'Аудит отменён пользователем',
  },

  levels: {
    L1: {
      name: 'Механизм',
      question: 'Работает ли мир как система?',
      description: 'Работает ли мир как система?',
      focus: 'Базовая связность, логика, экономика, 17 критериев живости',
    },
    L2: {
      name: 'Тело',
      question: 'Есть ли телесность и последствия?',
      description: 'Есть ли телесность и последствия?',
      focus: 'Доверие, рутина, пространственная память, цена Величия',
    },
    L3: {
      name: 'Психика',
      question: 'Работает ли мир как симптом?',
      description: 'Работает ли мир как симптом?',
      focus: 'Архитектура Горя (5 стадий × 4 уровня), глубина персонажей',
    },
    L4: {
      name: 'Мета',
      question: 'Задаёт ли вопрос реальной жизни агента?',
      description: 'Задаёт ли вопрос реальной жизни агента?',
      focus: 'Зеркало, Корнелианская дилемма, культовость, этика авторства',
    },
  },

  errors: {
    timeout: 'LLM не ответила за 30 секунд. Попробуйте ещё раз.',
    rate_limit:
      'Превышен лимит запросов. Подождите минуту и попробуйте снова.',
    truncated:
      'Ответ LLM был обрезан. Система обработает лучший результат.',
    network: 'Нет подключения к интернету',
    auth: 'Неверный API ключ. Проверьте ключ в настройках.',
    cors: 'Ошибка прокси. Проверьте URL прокси в настройках.',
    proxy: 'URL прокси не указан. Откройте настройки и введите URL вашего Cloudflare Worker.',
    provider: 'Ошибка на стороне провайдера: {message}',
    noApiKey:
      'API ключ не указан. Откройте настройки и введите API ключ.',
    unknown: 'Неизвестная ошибка',
    error: 'Ошибка',
  },

  progress: {
    stepLabel: 'Шаг {current} из {total}: {name}',
    elapsed: 'Прошло: {time}',
    estimatedRemaining: 'Ориентировочно осталось: {time}',
    processing: 'Обработка...',
    percentComplete: '{percent}% выполнено',
    progress: 'Прогресс',
    auditStopped: 'Аудит остановлен',
    streamingResponse: 'Ответ модели (streaming):',
  },

  settings: {
    title: 'Настройки LLM',
    description: 'Выберите AI-провайдера и настройте API ключ.',
    provider: 'AI Провайдер',
    providerSelect: 'Выберите провайдера',
    freeTier: 'БЕСПЛАТНО',
    freeTierAvailable: 'У этого провайдера есть бесплатный тариф!',
    model: 'Модель',
    modelDefault: 'По умолчанию: {model}',
    modelDocsLink: 'Список актуальных моделей →',
    apiKey: 'API Ключ',
    apiKeyPlaceholder: 'Введите ваш API ключ...',
    proxyUrl: 'URL Прокси',
    proxyUrlHint:
      'URL CORS-прокси для запросов к LLM. Преднастроено, изменяйте только при самостоятельном хостинге.',
    proxyUrlHintAdvanced:
      'Сервер-посредник для обхода CORS-ограничений браузера. Если вы не знаете что это — не меняйте этот URL. Он уже настроен для работы из коробки.',
    proxyUrlPlaceholder: 'URL прокси ещё не настроен! Замените <your-subdomain> на ваш реальный поддомен.',
    proxyHealthCheckBanner: 'Прокси временно недоступен. Аудит может не работать корректно.',
    advancedSettings: 'Расширенные настройки',
    rpmLimit: 'Лимит запросов/мин',
    rpmLimitHint: 'Максимальное количество запросов к API в минуту. Автозаполняется по провайдеру, но можно изменить.',
    rpmLimitLabel: 'Лимит: {rpm} запросов/мин',
    contextWindow: 'Контекстное окно (токены)',
    contextWindowHint: 'Максимальное количество токенов (запрос + ответ), которые модель может обработать. Оставьте пустым для автоопределения.',
    maxOutputTokens: 'Макс. выход (токены)',
    maxOutputTokensHint: 'Максимальное количество токенов в ответе модели. Оставьте пустым для автоопределения.',
    supportsJSONMode: 'Поддержка JSON-режима',
    supportsJSONModeHint: 'Может ли модель возвращать валидный JSON по запросу. Оставьте пустым для автоопределения.',
    capabilitiesHint: 'Переопределите автоматически определённые характеристики модели. Не изменяйте, если не уверены.',
    inputTooLongWarning: 'Входной текст может превышать контекстное окно модели. Будет применён chunking (разбиение на части).',
    outputTokensLowWarning: 'Модель может обрезать длинные ответы. Рекомендуется модель с max_output ≥ 4096 токенов.',
    testConnection: 'Проверить подключение',
    testing: 'Проверяем...',
    testSuccess: 'Подключение успешно!',
    testFailed: 'Ошибка подключения',
    apiKeyConfigured: 'API ключ {provider} настроен',
    howToGetKey: 'Как получить API ключ:',
    keySecurityNote:
      'Ваш API ключ хранится локально в браузере и не передаётся третьим лицам.',
    // Provider-specific instructions (Russian per Language Contract)
    providerInstructions: {
      google: {
        step1Text: 'Перейдите в Google AI Studio',
        step1Url: 'https://aistudio.google.com/apikey',
        step2: 'Создайте новый API ключ',
        step3: 'Бесплатный тариф: 15 запросов/мин, 1М токенов/день',
      },
      groq: {
        step1Text: 'Перейдите в Консоль Groq',
        step1Url: 'https://console.groq.com/keys',
        step2: 'Создайте API ключ (начинается с gsk_)',
        step3: 'Очень быстрый вывод, щедрый бесплатный тариф',
      },
      openrouter: {
        step1Text: 'Перейдите в OpenRouter',
        step1Url: 'https://openrouter.ai/keys',
        step2: 'Создайте API ключ',
        step3: 'Доступ ко многим моделям, некоторые бесплатные',
      },
      huggingface: {
        step1Text: 'Перейдите в Настройки Hugging Face',
        step1Url: 'https://huggingface.co/settings/tokens',
        step2: 'Создайте Токен Доступа',
        step3: 'Бесплатный API вывода (с ограничением скорости)',
      },
      together: {
        step1Text: 'Перейдите в Together AI',
        step1Url: 'https://api.together.xyz/settings/api-keys',
        step2: 'Создайте API ключ',
        step3: '1$ бесплатного кредита при регистрации',
      },
      openai: {
        step1Text: 'Перейдите на Платформу OpenAI',
        step1Url: 'https://platform.openai.com/api-keys',
        step2: 'Создайте API ключ (начинается с sk-)',
        step3: 'Оплата по факту использования',
      },
      anthropic: {
        step1Text: 'Перейдите в Консоль Anthropic',
        step1Url: 'https://console.anthropic.com/',
        step2: 'Создайте API ключ (начинается с sk-ant-)',
        step3: 'Оплата по факту использования',
      },
      mistral: {
        step1Text: 'Перейдите в Консоль Mistral',
        step1Url: 'https://console.mistral.ai/',
        step2: 'Создайте API ключ',
        step3: '',
      },
      deepseek: {
        step1Text: 'Перейдите на Платформу DeepSeek',
        step1Url: 'https://platform.deepseek.com/',
        step2: 'Создайте API ключ',
        step3: 'Очень конкурентные цены',
      },
      qwen: {
        step1Text: 'Перейдите в Alibaba DashScope',
        step1Url: 'https://dashscope.console.aliyun.com/',
        step2: 'Создайте API ключ',
        step3: '',
      },
      kimi: {
        step1Text: 'Перейдите на Платформу Moonshot',
        step1Url: 'https://platform.moonshot.cn/',
        step2: 'Создайте API ключ',
        step3: '',
      },
      xai: {
        step1Text: 'Перейдите в Консоль xAI',
        step1Url: 'https://console.x.ai/',
        step2: 'Создайте API ключ',
        step3: '',
      },
      zai: {
        step1Text: 'Обратитесь в Z.AI для получения доступа к API',
        step1Url: '',
        step2: 'Введите ваш API ключ здесь',
        step3: '',
      },
    },
  },

  // v3: Ключи для AuditReportViewV3 (5-блочный отчёт с markdown)
  report: {
    title: 'Отчёт аудита',
    protocolVersion: 'Universe Audit Protocol v3.1 (v10.0 diagnostics)',
    // Block labels
    block1: 'Ориентация',
    block2: 'Механизм (L1)',
    block3: 'Тело + Психика (L2+L3)',
    block4: 'Мета (L4)',
    block5: 'Синтез + Рекомендации',
    // Status labels
    waiting: 'Ожидание...',
    streaming: 'стрим',
    streamingFull: 'стримится...',
    generating: 'Генерация ответа...',
    completed: 'Завершено',
    blockPrefix: 'БЛОК',
    // Meta info
    tokens: 'Токены',
    time: 'Время',
    model: 'Модель',
    // Verdict options
    verdictAlive: 'Мир жив (13+/17 критериев)',
    verdictNeedsWork: 'Требует доработки (10-12/17)',
    verdictRedesign: 'Фундаментальный редизайн (<10/17)',
    // Download
    downloadMarkdown: 'Скачать MD',
    newAudit: 'Новый аудит',
    // Inspector labels
    inspector: 'Инспектор',
    navigation: 'Навигация',
    changeTheme: 'Сменить тему',
    session: 'Сессия',
    export: 'Экспорт',
    pipeline: 'Пайплайн',
    assessment: 'Оценка',
    criteria: 'критериев',
    provider: 'Провайдер',
    media: 'Медиа',
    progress: 'Прогресс аудита',
    debug: 'Отладка',
    rawMarkdown: 'Raw Markdown',
    noData: 'Нет данных',
  },

  // Tooltip labels (used in page.tsx header)
  tooltips: {
    navigation: 'Навигация',
    inspector: 'Инспектор',
    changeTheme: 'Сменить тему',
    settings: 'Настройки',
    newAudit: 'Новый аудит',
  },

  // Rail / sidebar strings
  rail: {
    brandName: 'Universe Audit',
    brandSub: 'PROTOCOL',
    preparing: 'Подготовка...',
    auditContext: 'Контекст аудита',
    mode: 'Режим',
    profile: 'Профиль',
    blockOf: 'Блок {current} из {total}',
    blockShort: 'Блок {current}/5',
    parts: '{count} частей',
    partOf: 'часть {current}/{total}',
  },

  // Score card strings
  score: {
    title: 'Оценка аудита',
    verdictAlive: 'Мир жив',
    verdictNeedsWork: 'Требует доработки',
    verdictRedesign: 'Фундаментальный редизайн',
    criteriaPassed: '{fulfilled} из {total} критериев пройдено',
    checklist: 'Чеклист',
    noItems: 'Нет элементов для выбранных фильтров',
    evidenceShow: 'показать',
    evidenceHide: 'скрыть',
    filterAll: 'Все',
    criteriaCol: 'Критерий',
    levelCol: 'Уровень',
    statusCol: 'Статус',
    evidenceCol: 'Доказательство',
  },

  // Home page description
  homeDescription:
    'Universe Audit Protocol v3.1 — полный аудит вымышленных миров по протоколу v10.0: 5 блоков, 52 критерия, 17 критериев живости, Архитектура Горя, Корнелианская дилемма, дерево решений для патчей. Бесплатный markdown-отчёт, streaming.',
} as const;
