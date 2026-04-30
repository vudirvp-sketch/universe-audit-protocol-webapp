/**
 * T1.6 — BREAK/DILEMMA Classification
 * Universe Audit Protocol v10.0
 * 
 * Implements "А чтобы что?" (What for?) chain analysis
 * with BREAK and DILEMMA classification
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ChainTerminal = 'BREAK' | 'DILEMMA' | 'UNCLASSIFIED';

export interface ChainStep {
  stepNumber: number;
  question: string;
  answer: string;
  analysis: string;
}

export interface WhatForChainResult {
  chain: ChainStep[];
  terminal: ChainTerminal;
  terminalStep: number;
  valid: boolean;
  action?: string;
  reasoning: string;
}

export interface DilemmaResult {
  value1: string;
  value2: string;
  conflict: string;
  stakes: string;
}

export interface BreakResult {
  brokenElement: string;
  reason: string;
  impact: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_CHAIN_LENGTH = 7;

const TERMINAL_CLASSIFIERS = {
  BREAK: {
    indicators: [
      'без причины', 'ничего', 'просто так', 'без цели',
      'случайно', 'произвольно', 'бессмыслен', 'бесцельно',
      'никакого влияния', 'не имеет значения', 'неважно'
    ],
    action: 'bind_to_law_or_remove'
  },
  DILEMMA: {
    indicators: [
      'выбирать между', 'либо либо', 'невозможно иметь оба',
      'должен пожертвовать', 'невозможный выбор', 'компромисс',
      'конфликт ценностей', 'нет правильного ответа', 'моральный конфликт'
    ],
    action: 'valid_terminal'
  }
};

// ============================================================================
// MAIN CHAIN EXECUTION
// ============================================================================

/**
 * Runs the "What for?" chain analysis
 * 
 * NON-NEGOTIABLE RULES:
 * - Max 7 iterations
 * - BREAK at step ≤4 = critical → action: "bind_to_law_or_remove"
 * - Unclassified terminal = invalid → retry
 */
export function runWhatForChain(
  initialClaim: string,
  answers: string[]
): WhatForChainResult {
  const chain: ChainStep[] = [];

  // Build chain from answers
  for (let i = 0; i < Math.min(answers.length, MAX_CHAIN_LENGTH); i++) {
    const step: ChainStep = {
      stepNumber: i + 1,
      question: i === 0 ? `Почему «${initialClaim}»?` : 'И что это даёт?',
      answer: answers[i],
      analysis: analyzeAnswer(answers[i])
    };
    chain.push(step);

    // Check for terminal classification
    const classification = classifyTerminal(answers[i]);
    if (classification !== 'UNCLASSIFIED') {
      return buildResult(chain, classification, i + 1);
    }
  }

  // No terminal found within chain
  return {
    chain,
    terminal: 'UNCLASSIFIED',
    terminalStep: chain.length,
    valid: false,
    action: 'retry_analysis',
    reasoning: 'Цепочка не достигла валидного терминала BREAK или DILEMMA за 7 шагов'
  };
}

// ============================================================================
// TERMINAL CLASSIFICATION
// ============================================================================

/**
 * Classifies a terminal answer as BREAK, DILEMMA, or UNCLASSIFIED
 */
function classifyTerminal(answer: string): ChainTerminal {
  const lowerAnswer = answer.toLowerCase();

  // Check for BREAK indicators
  for (const indicator of TERMINAL_CLASSIFIERS.BREAK.indicators) {
    if (lowerAnswer.includes(indicator)) {
      return 'BREAK';
    }
  }

  // Check for DILEMMA indicators
  for (const indicator of TERMINAL_CLASSIFIERS.DILEMMA.indicators) {
    if (lowerAnswer.includes(indicator)) {
      return 'DILEMMA';
    }
  }

  return 'UNCLASSIFIED';
}

/**
 * Builds the result object based on classification
 */
function buildResult(
  chain: ChainStep[],
  terminal: ChainTerminal,
  terminalStep: number
): WhatForChainResult {
  // BREAK at step ≤4 = critical
  if (terminal === 'BREAK' && terminalStep <= 4) {
    return {
      chain,
      terminal,
      terminalStep,
      valid: false, // BREAK is never "valid" as a goal
      action: 'bind_to_law_or_remove',
      reasoning: `BREAK на шаге ${terminalStep} (≤4) указывает на критическую структурную слабость. Элемент должен быть привязан к закону мира или удалён.`
    };
  }

  // BREAK at step >4
  if (terminal === 'BREAK') {
    return {
      chain,
      terminal,
      terminalStep,
      valid: false,
      action: 'review_element_necessity',
      reasoning: `BREAK на шаге ${terminalStep} (>4) — элемент может быть избыточным, но менее критичен. Рассмотрите возможность удаления.`
    };
  }

  // DILEMMA = valid terminal
  if (terminal === 'DILEMMA') {
    return {
      chain,
      terminal,
      terminalStep,
      valid: true,
      reasoning: `DILEMMA на шаге ${terminalStep} — валидное нарративное напряжение. Элемент создаёт осмысленный выбор.`
    };
  }

  return {
    chain,
    terminal: 'UNCLASSIFIED',
    terminalStep,
    valid: false,
    action: 'retry_analysis',
    reasoning: 'Терминал не удалось классифицировать'
  };
}

// ============================================================================
// ANSWER ANALYSIS
// ============================================================================

/**
 * Analyzes an individual answer in the chain
 */
function analyzeAnswer(answer: string): string {
  const lowerAnswer = answer.toLowerCase();
  const length = answer.length;

  // Check answer quality
  if (length < 10) {
    return 'Ответ слишком краткий — возможно, поверхностное рассуждение';
  }

  if (length > 200) {
    return 'Ответ слишком подробный — возможно, уход от сути вопроса';
  }

  // Check for avoidance patterns
  const avoidancePatterns = [
    'не знаю', 'не уверен', 'может быть', 'возможно',
    'зависит от', 'неясно', 'трудно сказать'
  ];

  for (const pattern of avoidancePatterns) {
    if (lowerAnswer.includes(pattern)) {
      return 'Ответ содержит неуверенность — требуется более глубокий анализ';
    }
  }

  // Check for justification patterns
  const justificationPatterns = [
    'потому что', 'для того чтобы', 'чтобы', 'для достижения',
    'позволяет', 'даёт возможность', 'создаёт', 'устанавливает'
  ];

  for (const pattern of justificationPatterns) {
    if (lowerAnswer.includes(pattern)) {
      return 'Ответ содержит обоснование — цепочку можно продолжить';
    }
  }

  return 'Ответ проанализирован — продолжаем цепочку';
}

// ============================================================================
// DILEMMA EXTRACTION
// ============================================================================

/**
 * Extracts dilemma details from a DILEMMA terminal
 */
export function extractDilemma(dilemmaAnswer: string): DilemmaResult {
  const lowerAnswer = dilemmaAnswer.toLowerCase();

  // Look for value patterns (Russian and English)
  const valuePatterns = [
    /выбирать между\s+(.+?)\s+и\s+(.+)/i,
    /либо\s+(.+?)\s+либо\s+(.+)/i,
    /(.+?)\s+против\s+(.+)/i,
    /невозможно иметь и\s+(.+?)\s+и\s+(.+)/i,
    /choose between\s+(\w+)\s+and\s+(\w+)/i,
    /either\s+(\w+)\s+or\s+(\w+)/i
  ];

  for (const pattern of valuePatterns) {
    const match = dilemmaAnswer.match(pattern);
    if (match) {
      return {
        value1: match[1],
        value2: match[2],
        conflict: `Конфликт между ${match[1]} и ${match[2]}`,
        stakes: 'Протагонист должен пожертвовать одним ради другого'
      };
    }
  }

  // Default extraction
  return {
    value1: 'Ценность А (извлечь из контекста)',
    value2: 'Ценность Б (извлечь из контекста)',
    conflict: 'Конфликтующие ценности требуют выбора',
    stakes: 'Выбор имеет значимые последствия'
  };
}

// ============================================================================
// BREAK ANALYSIS
// ============================================================================

/**
 * Analyzes a BREAK terminal for structural issues
 */
export function analyzeBreak(breakAnswer: string, stepNumber: number): BreakResult {
  const lowerAnswer = breakAnswer.toLowerCase();

  // Determine what element broke
  let brokenElement = 'неизвестно';
  
  if (lowerAnswer.includes('без причины') || lowerAnswer.includes('no reason')) {
    brokenElement = 'цель';
  } else if (lowerAnswer.includes('ничего') || lowerAnswer.includes('nothing')) {
    brokenElement = 'последствие';
  } else if (lowerAnswer.includes('произвольно') || lowerAnswer.includes('случайно') || lowerAnswer.includes('arbitrary')) {
    brokenElement = 'причинность';
  } else if (lowerAnswer.includes('бессмыслен') || lowerAnswer.includes('бесцельно') || lowerAnswer.includes('meaningless')) {
    brokenElement = 'смысл';
  }

  // Determine impact based on step number
  const impact = stepNumber <= 4
    ? 'Критическое — ранний обрыв цепочки указывает на фундаментальную структурную проблему'
    : 'Умеренное — поздний обрыв цепочки может указывать на незначительную избыточность';

  return {
    brokenElement,
    reason: breakAnswer,
    impact
  };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates a what-for chain result
 */
export function validateChainResult(result: WhatForChainResult): {
  valid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check chain length
  if (result.chain.length === 0) {
    issues.push('Пустая цепочка — анализ не выполнен');
    recommendations.push('Предоставьте хотя бы один ответ для начала анализа');
  }

  // Check for valid terminal
  if (result.terminal === 'UNCLASSIFIED') {
    issues.push('Неклассифицированный терминал — анализ незавершён');
    recommendations.push('Продолжите цепочку или проверьте последний ответ на индикаторы BREAK/DILEMMA');
  }

  // Check for critical BREAK
  if (result.terminal === 'BREAK' && result.terminalStep <= 4) {
    issues.push(`Критический BREAK на шаге ${result.terminalStep}`);
    recommendations.push('Привяжите элемент к закону мира или удалите из нарратива');
  }

  // Check for excessive chain length without terminal
  if (result.chain.length >= MAX_CHAIN_LENGTH && result.terminal === 'UNCLASSIFIED') {
    issues.push('Цепочка достигла максимальной длины без терминала');
    recommendations.push('Пересмотрите последний ответ — возможно, требуется реструктуризация');
  }

  return {
    valid: issues.length === 0 && result.valid,
    issues,
    recommendations
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats chain result for display
 */
export function formatChainResult(result: WhatForChainResult): string {
  const lines: string[] = [];
  
  lines.push('## Анализ цепочки «А чтобы что?»');
  lines.push('');

  lines.push('### Шаги цепочки:');
  for (const step of result.chain) {
    lines.push(`**Шаг ${step.stepNumber}:**`);
    lines.push(`- В: ${step.question}`);
    lines.push(`- О: ${step.answer}`);
    lines.push(`- Анализ: ${step.analysis}`);
    lines.push('');
  }

  lines.push('### Классификация терминала:');
  lines.push(`- Тип: **${result.terminal}**`);
  lines.push(`- Шаг: ${result.terminalStep}`);
  lines.push(`- Валидный: ${result.valid ? 'ДА' : 'НЕТ'}`);
  lines.push(`- Обоснование: ${result.reasoning}`);

  if (result.action) {
    lines.push('');
    lines.push(`### Требуемое действие: ${result.action}`);
  }

  return lines.join('\n');
}

/**
 * Quick check for chain viability
 */
export function quickChainCheck(claim: string): {
  needsAnalysis: boolean;
  estimatedDepth: number;
} {
  // Simple heuristics for estimating chain depth
  const lowerClaim = claim.toLowerCase();
  
  // Claims with "потому что" may need fewer steps
  if (lowerClaim.includes('потому что') || lowerClaim.includes('because')) {
    return { needsAnalysis: true, estimatedDepth: 2 };
  }

  // Claims with "почему" or "зачем" need deeper analysis
  if (lowerClaim.includes('почему') || lowerClaim.includes('зачем') || lowerClaim.includes('why') || lowerClaim.includes('what for')) {
    return { needsAnalysis: true, estimatedDepth: 4 };
  }

  // Default
  return { needsAnalysis: true, estimatedDepth: 3 };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MAX_CHAIN_LENGTH };
