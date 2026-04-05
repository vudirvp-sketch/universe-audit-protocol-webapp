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
      'no reason', 'nothing', 'just because', 'no purpose',
      'arbitrary', 'random', 'meaningless', 'pointless',
      'no impact', 'does not matter', 'inconsequential'
    ],
    action: 'bind_to_law_or_remove'
  },
  DILEMMA: {
    indicators: [
      'choose between', 'either or', 'cannot have both',
      'must sacrifice', 'impossible choice', 'trade-off',
      'conflicting values', 'no right answer', 'moral conflict'
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
      question: i === 0 ? `Why "${initialClaim}"?` : `And what does that achieve?`,
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
    reasoning: 'Chain did not reach a valid BREAK or DILEMMA terminal within 7 steps'
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
      reasoning: `BREAK at step ${terminalStep} (≤4) indicates critical structural weakness. Element must be bound to world law or removed.`
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
      reasoning: `BREAK at step ${terminalStep} (>4) suggests element may be unnecessary but less critical. Review for potential removal.`
    };
  }

  // DILEMMA = valid terminal
  if (terminal === 'DILEMMA') {
    return {
      chain,
      terminal,
      terminalStep,
      valid: true,
      reasoning: `DILEMMA at step ${terminalStep} indicates valid narrative tension. The element creates meaningful choice.`
    };
  }

  return {
    chain,
    terminal: 'UNCLASSIFIED',
    terminalStep,
    valid: false,
    action: 'retry_analysis',
    reasoning: 'Terminal could not be classified'
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
    return 'Answer too brief - may indicate shallow reasoning';
  }

  if (length > 200) {
    return 'Answer overly detailed - may be avoiding the core question';
  }

  // Check for avoidance patterns
  const avoidancePatterns = [
    'i don\'t know', 'not sure', 'maybe', 'perhaps',
    'it depends', 'unclear', 'hard to say'
  ];

  for (const pattern of avoidancePatterns) {
    if (lowerAnswer.includes(pattern)) {
      return 'Answer contains uncertainty - may need deeper analysis';
    }
  }

  // Check for justification patterns
  const justificationPatterns = [
    'because', 'so that', 'in order to', 'to achieve',
    'allows', 'enables', 'creates', 'establishes'
  ];

  for (const pattern of justificationPatterns) {
    if (lowerAnswer.includes(pattern)) {
      return 'Answer provides justification - chain can continue';
    }
  }

  return 'Answer analyzed - continuing chain';
}

// ============================================================================
// DILEMMA EXTRACTION
// ============================================================================

/**
 * Extracts dilemma details from a DILEMMA terminal
 */
export function extractDilemma(dilemmaAnswer: string): DilemmaResult {
  const lowerAnswer = dilemmaAnswer.toLowerCase();

  // Look for value patterns
  const valuePatterns = [
    /choose between (\w+) and (\w+)/i,
    /either (\w+) or (\w+)/i,
    /(\w+) versus (\w+)/i,
    /cannot have both (\w+) and (\w+)/i
  ];

  for (const pattern of valuePatterns) {
    const match = dilemmaAnswer.match(pattern);
    if (match) {
      return {
        value1: match[1],
        value2: match[2],
        conflict: `Conflict between ${match[1]} and ${match[2]}`,
        stakes: `Protagonist must sacrifice one for the other`
      };
    }
  }

  // Default extraction
  return {
    value1: 'Value A (extract from context)',
    value2: 'Value B (extract from context)',
    conflict: 'Conflicting values require choice',
    stakes: 'Choice has meaningful consequences'
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
  let brokenElement = 'unknown';
  
  if (lowerAnswer.includes('no reason')) {
    brokenElement = 'purpose';
  } else if (lowerAnswer.includes('nothing')) {
    brokenElement = 'consequence';
  } else if (lowerAnswer.includes('arbitrary') || lowerAnswer.includes('random')) {
    brokenElement = 'causality';
  } else if (lowerAnswer.includes('meaningless') || lowerAnswer.includes('pointless')) {
    brokenElement = 'meaning';
  }

  // Determine impact based on step number
  const impact = stepNumber <= 4
    ? 'Critical - early chain break indicates fundamental structural issue'
    : 'Moderate - late chain break may indicate minor redundancy';

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
    issues.push('Empty chain - no analysis performed');
    recommendations.push('Provide at least one answer to begin analysis');
  }

  // Check for valid terminal
  if (result.terminal === 'UNCLASSIFIED') {
    issues.push('Unclassified terminal - analysis incomplete');
    recommendations.push('Continue chain or review final answer for BREAK/DILEMMA indicators');
  }

  // Check for critical BREAK
  if (result.terminal === 'BREAK' && result.terminalStep <= 4) {
    issues.push(`Critical BREAK at step ${result.terminalStep}`);
    recommendations.push('Bind element to world law or remove from narrative');
  }

  // Check for excessive chain length without terminal
  if (result.chain.length >= MAX_CHAIN_LENGTH && result.terminal === 'UNCLASSIFIED') {
    issues.push('Chain reached max length without terminal');
    recommendations.push('Review final answer - may need restructuring');
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
  
  lines.push('## What-For Chain Analysis');
  lines.push('');

  lines.push('### Chain Steps:');
  for (const step of result.chain) {
    lines.push(`**Step ${step.stepNumber}:**`);
    lines.push(`- Q: ${step.question}`);
    lines.push(`- A: ${step.answer}`);
    lines.push(`- Analysis: ${step.analysis}`);
    lines.push('');
  }

  lines.push('### Terminal Classification:');
  lines.push(`- Type: **${result.terminal}**`);
  lines.push(`- Step: ${result.terminalStep}`);
  lines.push(`- Valid: ${result.valid ? 'YES' : 'NO'}`);
  lines.push(`- Reasoning: ${result.reasoning}`);

  if (result.action) {
    lines.push('');
    lines.push(`### Action Required: ${result.action}`);
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
  
  // Claims with "because" may need fewer steps
  if (lowerClaim.includes('because')) {
    return { needsAnalysis: true, estimatedDepth: 2 };
  }

  // Claims with "why" or "what for" need deeper analysis
  if (lowerClaim.includes('why') || lowerClaim.includes('what for')) {
    return { needsAnalysis: true, estimatedDepth: 4 };
  }

  // Default
  return { needsAnalysis: true, estimatedDepth: 3 };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { MAX_CHAIN_LENGTH };
