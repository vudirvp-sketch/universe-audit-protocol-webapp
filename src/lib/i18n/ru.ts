/**
 * Centralized Russian strings for the Universe Audit Protocol webapp.
 * All user-facing text is defined here as a flat const object.
 *
 * Language Contract (v16 §1.9):
 * - UI text: Russian
 * - JSON keys in LLM output: English
 * - JSON values in LLM output: Russian
 * - Enum values: English (displayed as-is in badges)
 *
 * Aligned with UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16:
 * 5-block pipeline, five coupled audit dimensions (§3),
 * qualitative verdict bands (§26.S), no numeric scoring (§1.4, §29).
 */

export const t = {
  app: {
    title: 'Протокол Аудита Вселенной',
    version: 'v16',
    subtitle:
      'Качественный аудит вымышленных миров по протоколу UNIVERSE AUDIT PROTOCOL ULTIMATE v16',
    description:
      'Протокол Аудита Вселенной исследует вымышленные миры через пять связанных измерений: мировую модель, системные последствия, человеческую материализацию, опыт и ёмкость историй, память и интерпретацию. Введите описание мира — протокол выявит корневые проблемы, предложит приоритетные вмешательства и сформулирует качественный вердикт без произвольных числовых оценок.',
    footer:
      'Протокол Аудита Вселенной v16 — 5 блоков, 5 измерений, качественный вердикт',
    footerStats: '5 измерений \u2022 5 блоков \u2022 v16',
    newAudit: 'Новый аудит',
    cancelAudit: 'Отменить аудит',
    startAudit: 'Начать аудит',
    analyzing: 'Анализируем...',
    clear: 'Очистить',
    save: 'Сохранить',
    saved: 'Сохранено!',
    settings: 'Настройки',
    block1Label: 'Контекст и скелет',
    block2Label: 'Механизм мира',
    block3Label: 'Эпистемика и человек',
    block4Label: 'Опыт, история, тема',
    block5Label: 'Корневые проблемы и рекомендации',
    exportMD: 'Скачать MD',
    exportJSON: 'Скачать JSON',
    exportHTML: 'Скачать HTML',
    copyToClipboard: 'Копировать',
    streamingInProgress: 'Генерация ответа...',
    inputHint:
      'Введите концепт — от пары предложений до целого рассказа. Длинные тексты обрабатываются автоматически.',
    // Inspector / Navigation
    inspector: 'Инспектор',
    navigation: 'Навигация',
    toggleNavigation: 'Панель навигации',
    toggleInspector: 'Панель инспектора',
    scrollToBlock: 'Перейти к блоку {n}',
  },

  form: {
    narrativeTitle: 'Ввод нарратива',
    narrativeDescription:
      'Введите концепт, структуру истории или описание мира для анализа',
    narrativeLabel: 'Нарратив / Текст концепта',
    narrativePlaceholder:
      'Введите концепт вашего нарратива, структуру истории или описание мира здесь...\n\nПример: Постапокалиптический мир, где воспоминания можно извлекать и продавать. Протагонист — торговец памятью — обнаруживает, что его собственные воспоминания были систематически стёрты, что ведёт его в путешествие за восстановление прошлого, пока он раскрывает заговор, угрожающий тому, что осталось от общества...',
    characterCount: '{count} символов | Минимум 100 символов рекомендуется',
    mediaType: 'Тип медиа',
    mediaTypeSelect: 'Выберите тип медиа',
    mediaNarrative: 'Нарратив',
    mediaGame: 'Игра',
    mediaVisual: 'Визуальное',
    mediaTtrpg: 'Настольная RPG',
    minCharsWarning: 'Минимум 50 символов для запуска аудита',
    uploadFile: 'Загрузить файл',
    supportedFormats: 'Поддерживаемые форматы: .txt, .md, .docx, .pdf',
    fileUploaded: 'Файл загружен: {name} ({size} символов)',
    fileReadError: 'Ошибка чтения файла',
    fileTypeError: 'Поддерживаются только текстовые файлы .txt и .md',
    fileTooLargeError: 'Файл слишком большой: максимум 512 КБ и 100 000 символов на артефакт',
    fileEmptyError: 'Файл пустой — текст не добавлен',
    fileEncodingError: 'Файл не в кодировке UTF-8 — пересохраните его в UTF-8 и попробуйте снова',
    // Guided mode framing — v16 §2 GUIDED MODE (optional)
    guidedTitle: 'Рамки аудита (необязательно)',
    guidedDescription:
      'Заполненное поле переключает аудит в режим guided: протокол учтёт ваши рамки в весах и применимости разделов, не снижая причинный стандарт.',
    guidedHint:
      'Пустые поля игнорируются — без заполненных рамок аудит остаётся в режиме lazy.',
    guidedGenre: 'Жанр',
    guidedGenrePlaceholder: 'Например: тёмное фэнтези, политическая НФ',
    guidedAudience: 'Целевая аудитория',
    guidedAudiencePlaceholder: 'Например: взрослые читатели, играющие в CRPG',
    guidedExperience: 'Целевой опыт',
    guidedExperiencePlaceholder: 'Например: ощущение, что у долга есть цена',
    guidedNonNegotiables: 'Непреложные элементы',
    guidedNonNegotiablesPlaceholder:
      'Столпы и решения, которые нельзя перепроектировать: ...',
    guidedKnownConcerns: 'Известные слабости',
    guidedKnownConcernsPlaceholder:
      'Что вы уже знаете о слабых местах мира — протокол проверит, а не перескажет: ...',
    guidedExcludedConcerns: 'Исключённые вопросы',
    guidedExcludedConcernsPlaceholder:
      'Темы и вопросы, которые аудит не должен открывать: ...',
    // Material-aware mode — v16 §2 MATERIAL-AWARE MODE (optional)
    materialsTitle: 'Дополнительные материалы (необязательно)',
    materialsDescription:
      'Два и более артефакта переключают аудит в режим material-aware: каждый артефакт — отдельный слой доказательств, а не дубль основного текста.',
    materialsHint:
      'Загрузите .txt или .md либо вставьте текст. Пустые артефакты не отправляются.',
    materialLabel: 'Название артефакта',
    materialRowTitle: 'Артефакт {n}',
    materialLabelPlaceholder: 'Например: лор-библия',
    materialText: 'Текст артефакта',
    materialTextPlaceholder: 'Вставьте текст артефакта или загрузите файл...',
    materialUpload: 'Загрузить .txt / .md',
    materialChars: '{count} символов',
    materialFallbackLabel: 'Материал {n}',
    addMaterial: 'Добавить артефакт',
    removeMaterial: 'Удалить артефакт',
    storageError:
      'Не удалось сохранить черновик в браузере: превышен лимит localStorage. Сократите материалы или очистите старые аудиты — после перезагрузки страницы последние изменения пропадут.',
  },

  // 5-блочный пайплайн v16
  phases: {
    idle: 'Готов',
    block1: 'Контекст и скелет',
    block2: 'Механизм мира',
    block3: 'Эпистемика и человек',
    block4: 'Опыт, история, тема',
    block5: 'Корневые проблемы и рекомендации',
    complete: 'Завершено',
    failed: 'Ошибка',
    cancelled: 'Отменено',
  },

  phaseDescriptions: {
    idle: 'Введите нарратив для начала',
    block1:
      'Контекст: режим аудита (lazy / guided / material-aware), двигатель нарратива, гипотеза авторского рисунка, скелет мира и быстрый скрининг из 7 вопросов',
    block2:
      'Механизм мира: пространство возможностей, причинные цепочки и охват, остаток, давление и смещение, связность систем, абляция и возмущения, география, масштаб, непрерывность макро–мезо–микро',
    block3:
      'Эпистемика и человек: слои истины и знание, утечка знания, расхождение перспектив, повседневность случайного прохожего, биография, абляция протагониста, культурная специфика и запреты',
    block4:
      'Опыт, история, тема: человеческая поверхность, телесность, юмор и боль, ёмкость историй, тематический закон, целостность разрешения, нарративный долг, соответствие медиуму, самобытность',
    block5:
      'Синтез: корневые проблемы с классами отказов, до пяти приоритетных рекомендаций, граница возможного и качественный вердикт по §26.S',
    complete: 'Аудит завершён',
    failed: 'Ошибка при выполнении аудита',
    cancelled: 'Аудит отменён пользователем',
  },

  // Пять связанных измерений аудита — v16 §3
  levels: {
    world: {
      name: 'Мировая модель',
      question: 'Что материально, социально и исторически истинно?',
      description: 'Что материально, социально и исторически истинно?',
      focus: 'Факты мира, история, институты, ограничения и возможности',
    },
    systemic: {
      name: 'Системные последствия',
      question: 'Что меняется из-за этой истины?',
      description: 'Что меняется из-за этой истины?',
      focus: 'Причинность, охват последствий, остаток, давление и связность',
    },
    human: {
      name: 'Человеческая материализация',
      question: 'Где последствие становится чьим-то прожитым состоянием?',
      description: 'Где последствие становится чьим-то прожитым состоянием?',
      focus: 'Повседневность, биография, агентность, культура и психология',
    },
    experience: {
      name: 'Опыт и ёмкость историй',
      question: 'Как аудитория может это встретить, вывести или почувствовать?',
      description: 'Как аудитория может это встретить, вывести или почувствовать?',
      focus: 'Человеческая поверхность, телесность, траектории и тема',
    },
    memory: {
      name: 'Память и интерпретация',
      question: 'Что выживает, накапливается, разрушается или меняется потом?',
      description: 'Что сохраняется, накапливается, разрушается или меняется потом?',
      focus: 'Нарративный долг, переинтерпретация, самобытность, след времени',
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
    keyMasked: 'Сохранённый ключ: {masked}',
    keyStorage: 'Хранение ключа',
    keyMemoryOnly: 'Не сохранять ключ на диск (только эта вкладка)',
    keyMemoryOnlyHint:
      'Ключ будет храниться в sessionStorage вкладки: перезагрузка страницы его сохранит, закрытие вкладки — удалит.',
    clearSettingsConfirm: 'Удалить все настройки, включая API-ключ?',
    proxyRequiredForTest: 'Сначала укажите URL прокси в расширенных настройках.',
    invalidProxyUrl: 'URL прокси должен начинаться с https:// (http разрешён только для localhost).',
    invalidBaseUrl: 'Base URL должен начинаться с https://, без query-параметров и логина/пароля.',
    howToGetKey: 'Как получить API ключ:',
    keySecurityNote:
      'Ключ хранится в этом браузере и отправляется только на CORS-прокси из «Расширенных настроек»; прокси пересылает его провайдеру и не сохраняет. Владелец прокси технически видит проходящий трафик — для полной приватности разверните свой прокси (см. worker/README.md) или включите «Не сохранять ключ на диск».',
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

  // Ключи для AuditReportViewV3 (5-блочный отчёт с markdown)
  report: {
    title: 'Отчёт аудита',
    protocolVersion: 'UNIVERSE AUDIT PROTOCOL ULTIMATE v16',
    // Block labels
    block1: 'Контекст и скелет',
    block2: 'Механизм мира',
    block3: 'Эпистемика и человек',
    block4: 'Опыт, история, тема',
    block5: 'Корневые проблемы и рекомендации',
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
    assessment: 'Вердикт',
    provider: 'Провайдер',
    media: 'Медиа',
    progress: 'Прогресс аудита',
    debug: 'Отладка',
    rawMarkdown: 'Raw Markdown',
    noData: 'Нет данных',
    // Author framing / artefacts (v16 §2) — used by exports
    framing: 'Рамки аудита',
    artefacts: 'Дополнительные материалы',
    artefactChars: '{count} символов',
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
    brandSub: 'PROTOCOL v16',
    preparing: 'Подготовка...',
    auditContext: 'Контекст аудита',
    mode: 'Режим аудита',
    authorship: 'Гипотеза авторства',
    blockOf: 'Блок {current} из {total}',
    blockShort: 'Блок {current}/5',
    parts: '{count} частей',
    partOf: 'часть {current}/{total}',
  },

  // Режимы аудита — v16 §2
  modes: {
    lazy: 'Быстрый (lazy)',
    guided: 'Направляемый (guided)',
    material_aware: 'С учётом материала (material aware)',
  },

  // Вердикт v16 §26.S — качественные полосы, без процентов
  verdict: {
    title: 'Вердикт аудита',
    overall: 'Общее состояние',
    confidence: 'Уверенность',
    indicator: 'Показатель',
    valueCol: 'Значение',
    bands: {
      world_foundation: 'Фундамент мира',
      systemic_depth: 'Системная глубина',
      human_integration: 'Человеческая интеграция',
      experiential_integration: 'Опытная интеграция',
      story_capacity: 'Ёмкость историй',
      identity: 'Идентичность',
      overall_state: 'Общее состояние',
    },
    // Значения полос и уверенности (English enum → Russian word)
    values: {
      weak: 'слабая',
      developing: 'развивающаяся',
      coherent: 'связная',
      strong: 'сильная',
      narrow: 'узкая',
      focused: 'сфокусированная',
      broad: 'широкая',
      highly_generative: 'высоко генеративная',
      diffuse: 'диффузная',
      emerging: 'формирующаяся',
      distinct: 'отчётливая',
      highly_distinct: 'высоко отчётливая',
      fragile: 'хрупкое',
      viable: 'жизнеспособное',
      robust: 'устойчивое',
      unusually_generative: 'необычайно генеративное',
      high: 'высокая',
      mixed: 'смешанная',
      low: 'низкая',
    },
    issues: 'Корневые проблемы',
    recommendations: 'Рекомендации',
    // Формы для счётчиков: [одна, две–четыре, ноль/пять+]
    counts: {
      problems: ['корневая проблема', 'корневые проблемы', 'корневых проблем'],
      recommendations: ['рекомендация', 'рекомендации', 'рекомендаций'],
    },
    frontier: 'Граница возможного',
    frontierLabels: {
      demonstrated: 'Доказано',
      under_proven: 'Недостаточно доказано',
      latent: 'Латентно',
      new_primitive_required: 'Нужен новый примитив',
      experimental: 'Экспериментально',
      deferred: 'Отложено',
      contradicted_or_should_not_add: 'Противоречит замыслу',
    },
    closing: 'Итог',
    sourceJson: 'Из машинного блока §27',
    sourceMarkdown: 'Восстановлено из текста отчёта',
    fallback:
      'Вердикт не сформирован: модель не вернула качественные полосы §26.S.',
    pending: 'Вердикт появится после завершения аудита',
    docs: 'Качественные полосы — диагностика, а не оценка качества (§26.S).',
  },

  // Быстрый скрининг — v16 §6
  fastScreen: {
    title: 'Быстрый скрининг',
    subtitle: 'Семь проверок перед основным аудитом',
    mode: 'Режим аудита',
    answers: {
      YES: 'ДА',
      PARTIAL: 'ЧАСТИЧНО',
      NO: 'НЕТ',
      UNKNOWN: 'НЕИЗВЕСТНО',
      NA: 'Н/П',
    },
    unparsed: 'нет ответа',
    empty: 'Быстрый скрининг не распознан в ответе модели.',
    foundationLimited:
      'Материала недостаточно для построения скелета мира (FOUNDATION-LIMITED). Аудит ограничен фундаментом: часть проверок неприменима.',
  },

  // Home page description
  homeDescription:
    'Протокол Аудита Вселенной v16 — качественный аудит вымышленных миров: 5 блоков, 14 запросов к LLM, пять связанных измерений, метки доказательности EXPLICIT / DERIVED / INFERRED / HYPOTHESIS / UNKNOWN, корневые проблемы, приоритетные рекомендации и вердикт в качественных полосах. Без числовых оценок и чек-листов.',
} as const;
