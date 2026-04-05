/**
 * T3.3 — Self-Audit Dialogic Pause + Data Flag
 * Universe Audit Protocol v10.0
 * 
 * Implements §13 Self-Audit interactive mode:
 * - If interactive: true → pause audit, output author_questions
 * - Wait for author response before proceeding to L4
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SelfAuditState {
  interactive: boolean;
  author_questions: string[];
  requires_author_input: boolean;
  author_responses?: Record<string, string>;
  note?: string;
  processed: boolean;
}

export interface SelfAuditQuestion {
  id: string;
  text: string;
  context: string;
  importance: 'critical' | 'major' | 'minor';
}

// ============================================================================
// SELF-AUDIT QUESTIONS (§13)
// ============================================================================

const SELF_AUDIT_QUESTIONS: SelfAuditQuestion[] = [
  {
    id: 'SQ1',
    text: 'What do I fear showing in this world?',
    context: 'Examines author vulnerability and thematic honesty',
    importance: 'critical'
  },
  {
    id: 'SQ2',
    text: 'If I kill this world — what part of myself do I kill?',
    context: 'Reveals personal stakes in narrative destruction',
    importance: 'critical'
  },
  {
    id: 'SQ3',
    text: 'Does this world ask a question I\'m afraid to ask myself?',
    context: 'Identifies unconscious thematic content',
    importance: 'major'
  },
  {
    id: 'SQ4',
    text: 'Do I respect my reader?',
    context: 'Evaluates author-audience relationship',
    importance: 'major'
  }
];

// ============================================================================
// MAIN EXECUTION FUNCTION
// ============================================================================

/**
 * Executes §13 Self-Audit phase
 * 
 * PROTOCOL:
 * - If interactive: true → pause, output questions, wait for response
 * - If interactive: false → output questions + note, continue to L4
 */
export function executeSelfAudit(interactive: boolean): SelfAuditState {
  const questions = SELF_AUDIT_QUESTIONS.map(q => q.text);
  
  if (interactive) {
    return {
      interactive: true,
      author_questions: questions,
      requires_author_input: true,
      processed: false
      // PAUSE: Audit halts here, waiting for author response
    };
  }
  
  return {
    interactive: false,
    author_questions: questions,
    requires_author_input: false,
    note: 'Author input recommended for L4 fidelity. Continuing without waiting.',
    processed: true
    // CONTINUE: Proceed to L4
  };
}

/**
 * Processes author responses and continues audit
 */
export function processAuthorResponses(
  state: SelfAuditState,
  responses: Record<string, string>
): SelfAuditState {
  return {
    ...state,
    author_responses: responses,
    requires_author_input: false,
    processed: true
  };
}

/**
 * Validates author responses completeness
 */
export function validateAuthorResponses(
  responses: Record<string, string>
): { valid: boolean; missing: string[] } {
  const requiredIds = SELF_AUDIT_QUESTIONS
    .filter(q => q.importance === 'critical')
    .map(q => q.id);
  
  const missing: string[] = [];
  
  for (const id of requiredIds) {
    if (!responses[id] || responses[id].trim().length < 10) {
      missing.push(id);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Generates self-audit insights from responses
 */
export function generateSelfAuditInsights(
  responses: Record<string, string>
): string[] {
  const insights: string[] = [];
  
  // SQ1 insight: fear analysis
  if (responses['SQ1']) {
    const fearResponse = responses['SQ1'].toLowerCase();
    if (fearResponse.includes('truth') || fearResponse.includes('reality')) {
      insights.push('Consider how this fear of truth/reality manifests in world mechanics');
    }
    if (fearResponse.includes('vulnerab')) {
      insights.push('Vulnerability theme detected - ensure it resonates through character arcs');
    }
  }
  
  // SQ2 insight: personal stakes
  if (responses['SQ2']) {
    const killResponse = responses['SQ2'].toLowerCase();
    if (killResponse.includes('part of me') || killResponse.includes('myself')) {
      insights.push('Strong personal investment detected - verify this enhances rather than limits narrative');
    }
  }
  
  // SQ3 insight: unconscious content
  if (responses['SQ3']) {
    const questionResponse = responses['SQ3'].toLowerCase();
    if (questionResponse.includes('yes')) {
      insights.push('Thematic question has personal resonance - double-check it remains universal for audience');
    }
  }
  
  // SQ4 insight: reader respect
  if (responses['SQ4']) {
    const respectResponse = responses['SQ4'].toLowerCase();
    if (respectResponse.includes('no') || respectResponse.includes('not sure')) {
      insights.push('CRITICAL: Reader respect issue detected - review for condescension or manipulation');
    }
  }
  
  return insights;
}

/**
 * Formats self-audit state for display
 */
export function formatSelfAuditState(state: SelfAuditState): string {
  const lines: string[] = [];
  
  lines.push('## §13 Self-Audit');
  lines.push('');
  lines.push(`**Interactive Mode:** ${state.interactive ? 'YES' : 'NO'}`);
  lines.push(`**Requires Author Input:** ${state.requires_author_input ? 'YES' : 'NO'}`);
  lines.push(`**Processed:** ${state.processed ? 'YES' : 'NO'}`);
  lines.push('');
  
  if (state.author_questions.length > 0) {
    lines.push('### Author Questions:');
    state.author_questions.forEach((q, idx) => {
      lines.push(`${idx + 1}. ${q}`);
    });
    lines.push('');
  }
  
  if (state.note) {
    lines.push(`**Note:** ${state.note}`);
    lines.push('');
  }
  
  if (state.author_responses) {
    lines.push('### Author Responses:');
    const questionTexts = SELF_AUDIT_QUESTIONS.map(q => q.text);
    for (const [id, response] of Object.entries(state.author_responses)) {
      const questionText = questionTexts[parseInt(id.replace('SQ', '')) - 1] || id;
      lines.push(`**Q: ${questionText}**`);
      lines.push(`A: ${response}`);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { SELF_AUDIT_QUESTIONS };
