/**
 * Centralized Russian strings for the Universe Audit Protocol.
 * All user-facing text is defined here as a flat const object.
 * Based on COMPLETION_PLAN Section 3.1 (expanded).
 */

export const t = {
  app: {
    title: 'Протокол Аудита Вселенной',
    version: 'v10.0',
    subtitle: 'Анализ вымышленных миров через 4 иерархических уровня',
    description:
      'Протокол Аудита Вселенной оценивает вымышленные миры через 4 иерархических уровня: Механизм, Тело, Психика и Мета. Каждый уровень требует порогового балла для прохождения (60% для конфликтного режима, 50% для кирё, 55% для гибридного).',
    footer:
      'Протокол Аудита Вселенной v10.0 — На основе протокола «АУДИТ_ВСЕЛЕННОЙ_v10.0.md»',
    footerStats: '4 уровня • 52 критерия • Порог зависит от режима',
    newAudit: 'Новый аудит',
    cancelAudit: 'Отменить аудит',
    startAudit: 'Начать аудит',
    analyzing: 'Анализируем...',
    clear: 'Очистить',
    save: 'Сохранить',
    saved: 'Сохранено!',
    settings: 'Настройки',
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
    auditMode: 'Режим аудита',
    auditModeDescription:
      'Выберите режим структуры нарратива, который лучше всего подходит вашей истории',
    detection: 'Определение: {questions}',
    authorProfileTitle: 'Опрос профиля автора',
    authorProfileDescription:
      'Опционально: ответьте на 7 вопросов для определения вашего авторского профиля',
    authorProfileHint:
      'Эти вопросы помогают определить, кто вы: «Садовник» (писатель-исследователь) или «Архитектор» (планировщик). Это влияет на типы проблем, которые аудит будет приоритизировать.',
    keySignal: 'Ключевой сигнал (×{weight})',
    weight: 'Вес: {weight}',
    profileDetermined: 'Профиль определён!',
    profileDeterminedHint:
      'Ваш авторский профиль будет рассчитан при запуске аудита.',
    minCharsWarning: 'Минимум 50 символов для запуска аудита',
  },

  phases: {
    idle: 'Готов',
    input_validation: 'Валидация ввода',
    mode_detection: 'Определение режима',
    author_profile: 'Профиль автора',
    skeleton_extraction: 'Извлечение скелета',
    screening: 'Быстрый скрининг',
    L1_evaluation: 'Гейт L1: Механизм',
    L2_evaluation: 'Гейт L2: Тело',
    L3_evaluation: 'Гейт L3: Психика',
    L4_evaluation: 'Гейт L4: Мета',
    issue_generation: 'Проблемы и цепочки',
    generative_modules: 'Генеративные модули',
    final_output: 'Диагностика и итог',
    complete: 'Завершено',
    failed: 'Ошибка',
    blocked: 'Заблокировано',
    cancelled: 'Отменено',
  },

  phaseDescriptions: {
    idle: 'Введите нарратив для начала',
    input_validation: 'Проверка ввода',
    mode_detection: 'Определение режима аудита',
    author_profile: 'Анализ профиля автора',
    skeleton_extraction: 'Извлечение скелета нарратива',
    screening: 'Быстрый 7-вопросный скрининг',
    L1_evaluation: 'Проверка системной связности',
    L2_evaluation: 'Воплощённость и последствия',
    L3_evaluation: 'Проверка психологической глубины',
    L4_evaluation: 'Мета-нарративный уровень',
    issue_generation: 'Генерация проблем и цепочек',
    generative_modules: 'Генеративные модули',
    final_output: 'Финальная диагностика',
    complete: 'Аудит завершён',
    failed: 'Гейт не пройден — требуется исправление',
    blocked: 'Аудит остановлен',
    cancelled: 'Аудит отменён пользователем',
  },

  gates: {
    blockedTitle: 'Аудит остановлен на уровне {level}',
    blockedDescription:
      'Концепт не прошёл порог {threshold}% на уровне {level}',
    fixAndContinue: 'Исправить и продолжить',
    status: 'Статус гейтов',
    requirement: 'Порог зависит от режима аудита',
    score: 'Балл',
  },

  errors: {
    timeout: 'LLM не ответила за 30 секунд. Попробуйте ещё раз.',
    invalid_json: 'LLM вернула невалидный JSON. Перезапускаем шаг...',
    rate_limit:
      'Превышен лимит запросов. Подождите минуту и попробуйте снова.',
    truncated:
      'Ответ LLM был обрезан. Перезапускаем с увеличенным лимитом токенов...',
    network: 'Нет подключения к интернету',
    auth: 'Неверный API ключ. Проверьте ключ в настройках.',
    cors: 'Ошибка прокси. Проверьте URL прокси в настройках.',
    proxy: 'URL прокси не указан. Откройте настройки и введите URL вашего Cloudflare Worker.',
    provider: 'Ошибка на стороне провайдера: {message}',
    noApiKey:
      'API ключ не указан. Откройте настройки и введите API ключ.',
    unknown: 'Неизвестная ошибка',
  },

  progress: {
    stepLabel: 'Шаг {current} из {total}: {name}',
    elapsed: 'Прошло: {time}',
    estimatedRemaining: 'Ориентировочно осталось: {time}',
    processing: 'Обработка...',
    percentComplete: '{percent}% выполнено',
    progress: 'Прогресс',
    auditStopped: 'Аудит остановлен',
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
    apiKey: 'API Ключ',
    apiKeyPlaceholder: 'Введите ваш API ключ...',
    proxyUrl: 'URL Прокси',
    proxyUrlHint:
      'URL вашего Cloudflare Worker CORS-прокси. Развёртывается из директории worker/',
    apiKeyConfigured: 'API ключ {provider} настроен',
    howToGetKey: 'Как получить API ключ:',
    keySecurityNote:
      'Ваш API ключ хранится локально в браузере и не передаётся третьим лицам.',
  },

  tabs: {
    report: 'Отчёт',
    gates: 'Гейты',
    issues: 'Проблемы',
    chains: 'Цепочки',
    generative: 'Генерация',
    checklist: 'Чеклист',
    grief: 'Горе-матрица',
  },

  config: {
    title: 'Конфигурация',
    media: 'Медиа',
    mode: 'Режим',
    input: 'Ввод',
    characters: '{count} символов',
    modeDetecting: 'определение...',
  },

  levels: {
    L1: { name: 'Механизм', question: 'Работает ли мир как система?' },
    L2: { name: 'Тело', question: 'Есть ли воплощённость?' },
    L3: { name: 'Психика', question: 'Работает ли как симптом?' },
    L4: { name: 'Мета', question: 'Спрашивает ли о реальной жизни?' },
  },
} as const;
