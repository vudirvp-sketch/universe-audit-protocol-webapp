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
 */

export const t = {
  app: {
    title: 'Протокол Аудита Вселенной',
    version: 'v3.0',
    subtitle: 'Анализ вымышленных миров через 4 иерархических уровня',
    description:
      'Протокол Аудита Вселенной оценивает вымышленные миры через 4 иерархических уровня: Механизм, Тело, Психика и Мета. Введите описание вашего мира — и протокол выявит слабости, предложит исправления и оценит культовый потенциал.',
    footer:
      'Протокол Аудита Вселенной v11.0 — На основе протокола \u00ABАУДИТ_ВСЕЛЕННОЙ_v11.0.md\u00BB',
    footerStats: '4 уровня \u2022 5 блоков \u2022 free-form markdown',
    newAudit: 'Новый аудит',
    cancelAudit: 'Отменить аудит',
    startAudit: 'Начать аудит',
    analyzing: 'Анализируем...',
    clear: 'Очистить',
    save: 'Сохранить',
    saved: 'Сохранено!',
    settings: 'Настройки',
    criteriaCount: '52 критерия',
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
    block1: 'Определение режима аудита, профиля автора, скелета концепта и скрининга',
    block2: 'Аудит механизма: работает ли мир как система (L1)?',
    block3: 'Аудит тела и психики: телесность, персонажи, архитектура горя (L2+L3)',
    block4: 'Аудит мета-уровня: дилемма, этика, мисдирекшн (L4)',
    block5: 'Синтез: приоритизированные рекомендации и итоговый вердикт',
    complete: 'Аудит завершён',
    failed: 'Ошибка при выполнении аудита',
    cancelled: 'Аудит отменён пользователем',
  },

  levels: {
    L1: {
      name: 'Механизм',
      question: 'Работает ли мир как система?',
      description: 'Работает ли мир как система?',
      focus: 'Базовая связность, логика, экономика',
    },
    L2: {
      name: 'Тело',
      question: 'Есть ли воплощённость?',
      description: 'Есть ли воплощённость и последствия?',
      focus: 'Доверие, рутина, пространственная память',
    },
    L3: {
      name: 'Психика',
      question: 'Работает ли как симптом?',
      description: 'Работает ли мир как симптом?',
      focus: 'Архитектура горя, глубина персонажей',
    },
    L4: {
      name: 'Мета',
      question: 'Спрашивает ли о реальной жизни?',
      description: 'Спрашивает ли о реальной жизни?',
      focus: 'Зеркало, культовый статус, этика авторства',
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
        step1: 'Перейдите в <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Google AI Studio</a>',
        step2: 'Создайте новый API ключ',
        step3: 'Бесплатный тариф: 15 запросов/мин, 1М токенов/день',
      },
      groq: {
        step1: 'Перейдите в <a href="https://console.groq.com/keys" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Консоль Groq</a>',
        step2: 'Создайте API ключ (начинается с gsk_)',
        step3: 'Очень быстрый вывод, щедрый бесплатный тариф',
      },
      openrouter: {
        step1: 'Перейдите в <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="text-blue-500 hover:underline">OpenRouter</a>',
        step2: 'Создайте API ключ',
        step3: 'Доступ ко многим моделям, некоторые бесплатные',
      },
      huggingface: {
        step1: 'Перейдите в <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Настройки Hugging Face</a>',
        step2: 'Создайте Токен Доступа',
        step3: 'Бесплатный API вывода (с ограничением скорости)',
      },
      together: {
        step1: 'Перейдите в <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Together AI</a>',
        step2: 'Создайте API ключ',
        step3: '1$ бесплатного кредита при регистрации',
      },
      openai: {
        step1: 'Перейдите на <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Платформу OpenAI</a>',
        step2: 'Создайте API ключ (начинается с sk-)',
        step3: 'Оплата по факту использования',
      },
      anthropic: {
        step1: 'Перейдите в <a href="https://console.anthropic.com/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Консоль Anthropic</a>',
        step2: 'Создайте API ключ (начинается с sk-ant-)',
        step3: 'Оплата по факту использования',
      },
      mistral: {
        step1: 'Перейдите в <a href="https://console.mistral.ai/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Консоль Mistral</a>',
        step2: 'Создайте API ключ',
        step3: '',
      },
      deepseek: {
        step1: 'Перейдите на <a href="https://platform.deepseek.com/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Платформу DeepSeek</a>',
        step2: 'Создайте API ключ',
        step3: 'Очень конкурентные цены',
      },
      qwen: {
        step1: 'Перейдите в <a href="https://dashscope.console.aliyun.com/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Alibaba DashScope</a>',
        step2: 'Создайте API ключ',
        step3: '',
      },
      kimi: {
        step1: 'Перейдите на <a href="https://platform.moonshot.cn/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Платформу Moonshot</a>',
        step2: 'Создайте API ключ',
        step3: '',
      },
      xai: {
        step1: 'Перейдите в <a href="https://console.x.ai/" target="_blank" rel="noopener" class="text-blue-500 hover:underline">Консоль xAI</a>',
        step2: 'Создайте API ключ',
        step3: '',
      },
      zai: {
        step1: 'Обратитесь в Z.AI для получения доступа к API',
        step2: 'Введите ваш API ключ здесь',
        step3: '',
      },
    },
  },

  // v3: Ключи для AuditReportViewV3 (5-блочный отчёт с markdown)
  report: {
    title: 'Отчёт аудита',
    protocolVersion: 'Universe Audit Protocol v3',
    // Block labels
    block1: 'Ориентация',
    block2: 'Механизм (L1)',
    block3: 'Тело + Психика (L2+L3)',
    block4: 'Мета (L4)',
    block5: 'Синтез + Рекомендации',
    // Status labels
    waiting: 'Ожидание...',
    streaming: 'стримится...',
    completed: 'Завершено',
    // Meta info
    tokens: 'Токены',
    time: 'Время',
    model: 'Модель',
    // Verdict options
    verdictAlive: 'Мир жив',
    verdictNeedsWork: 'Требует доработки',
    verdictRedesign: 'Фундаментальный редизайн',
    // Download
    downloadMarkdown: 'Скачать MD',
    newAudit: 'Новый аудит',
  },

  // Grief architecture (used in AuditReportView)
  grief: {
    title: 'Матрица архитектуры горя',
    description: '5 стадий \u00D7 4 уровня материализации',
    dominantStage: 'Доминирующая стадия',
    dominant: 'ДОМИНАНТНАЯ',
    levelLabels: {
      character: 'Персонаж',
      location: 'Локация',
      mechanic: 'Механика/Действие',
      act: 'Нарративный акт',
    },
    // Grief stage descriptions
    denial: 'Отказ принять реальность',
    anger: 'Фрустрация и эмоциональный взрыв',
    bargaining: 'Попытка договориться или отсрочить',
    depression: 'Глубокая грусть и замкнутость',
    acceptance: 'Примирение с реальностью',
  },

  // Generative modules (used in AuditReportView)
  generative: {
    title: 'Генеративные модули',
    griefMapping: 'Карта горя',
    dilemma: 'Корнелианская дилемма',
    notApplicable: 'Не применимо',
  },

  // Home page description
  homeDescription:
    'Universe Audit Protocol v3 — анализ вымышленных миров через 5 последовательных блоков: Ориентация, Механизм, Тело+Психика, Мета, Синтез. Бесплатный markdown-отчёт, streaming, без гейтов и блокировок.',
} as const;
