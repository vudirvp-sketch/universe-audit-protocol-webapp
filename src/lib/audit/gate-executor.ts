/**
 * T0.3 — Imperative Gate Language
 * Universe Audit Protocol v10.0
 * 
 * Implements gate execution with halt conditions
 * Gate failure: STOP, output fixes for that level only
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type GateStatus = 'pending' | 'running' | 'passed' | 'failed' | 'blocked' | 'skipped';

export type GateLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface GateCondition {
  id: string;
  name: string;
  description: string;
  check: (input: unknown) => boolean;
  haltOnFailure: boolean;
  level: GateLevel;
}

export interface GateResult {
  gateId: string;
  gateName: string;
  status: GateStatus;
  score: number; // 0-100
  conditions: {
    id: string;
    passed: boolean;
    message: string;
  }[];
  halt: boolean; // true = STOP execution
  fixes: string[];
  metadata: Record<string, unknown>;
}

export interface GateSequence {
  gates: GateResult[];
  currentGate: number;
  halted: boolean;
  haltReason?: string;
  totalScore: number;
}

export interface BlockedStatus {
  blocked: true;
  reason: string;
  requiredFixes: string[];
  retryable: boolean;
}

// ============================================================================
// GATE DEFINITIONS
// ============================================================================

const GATE_DEFINITIONS = {
  GATE_0: {
    id: 'GATE-0',
    name: 'Input Validation',
    level: 'L0' as GateLevel,
    description: 'Validates basic input structure and required fields',
    haltOnFailure: true
  },
  GATE_1: {
    id: 'GATE-1',
    name: 'Skeleton Extraction',
    level: 'L0' as GateLevel,
    description: 'Extracts and validates core narrative skeleton',
    haltOnFailure: true
  },
  GATE_2: {
    id: 'GATE-2',
    name: 'Thematic Law',
    level: 'L1' as GateLevel,
    description: 'Validates thematic law affects world physics/economy',
    haltOnFailure: false
  },
  GATE_3: {
    id: 'GATE-3',
    name: 'Root Trauma',
    level: 'L1' as GateLevel,
    description: 'Validates root trauma as ideological foundation',
    haltOnFailure: false
  },
  GATE_4: {
    id: 'GATE-4',
    name: 'Hamartia',
    level: 'L1' as GateLevel,
    description: 'Validates hamartia connects to ending',
    haltOnFailure: false
  },
  GATE_5: {
    id: 'GATE-5',
    name: 'Character Arcs',
    level: 'L2' as GateLevel,
    description: 'Validates character development consistency',
    haltOnFailure: false
  },
  GATE_6: {
    id: 'GATE-6',
    name: 'Grief Architecture',
    level: 'L3' as GateLevel,
    description: 'Validates grief stage distribution',
    haltOnFailure: true // HARD CHECK for L3
  }
};

// ============================================================================
// GATE EXECUTION FUNCTIONS
// ============================================================================

/**
 * Validates prerequisites for gate execution
 * Returns blocked status if prerequisites not met
 */
export function validatePrerequisites(
  gateId: string,
  previousGates: GateResult[]
): { canProceed: boolean; blockedBy?: string; reason?: string } {
  
  const gateIndex = Object.keys(GATE_DEFINITIONS).findIndex(
    key => GATE_DEFINITIONS[key as keyof typeof GATE_DEFINITIONS].id === gateId
  );

  if (gateIndex <= 0) {
    return { canProceed: true };
  }

  // Check all previous gates passed
  for (let i = 0; i < gateIndex; i++) {
    const prevGateKey = Object.keys(GATE_DEFINITIONS)[i] as keyof typeof GATE_DEFINITIONS;
    const prevGateDef = GATE_DEFINITIONS[prevGateKey];
    const prevGateResult = previousGates.find(g => g.gateId === prevGateDef.id);

    if (!prevGateResult) {
      return {
        canProceed: false,
        blockedBy: prevGateDef.id,
        reason: `Gate ${prevGateDef.id} has not been executed`
      };
    }

    if (prevGateResult.status === 'failed' && prevGateResult.halt) {
      return {
        canProceed: false,
        blockedBy: prevGateDef.id,
        reason: `Gate ${prevGateDef.id} failed with halt condition`
      };
    }
  }

  return { canProceed: true };
}

/**
 * Executes a single gate with imperative halt condition
 * 
 * NON-NEGOTIABLE: If any gate fails, STOP
 * Output fixes for that level only
 */
export function executeGate(
  gateId: string,
  input: unknown,
  validators: ((input: unknown) => { passed: boolean; score: number; message: string })[]
): GateResult {
  const gateDef = GATE_DEFINITIONS[gateId as keyof typeof GATE_DEFINITIONS];
  
  if (!gateDef) {
    return {
      gateId,
      gateName: 'Unknown Gate',
      status: 'failed',
      score: 0,
      conditions: [],
      halt: true,
      fixes: ['Invalid gate ID'],
      metadata: {}
    };
  }

  const conditions: GateResult['conditions'] = [];
  let totalScore = 0;
  let allPassed = true;

  for (const validator of validators) {
    const result = validator(input);
    conditions.push({
      id: `condition_${conditions.length}`,
      passed: result.passed,
      message: result.message
    });
    
    totalScore += result.score;
    if (!result.passed) {
      allPassed = false;
    }
  }

  const averageScore = validators.length > 0 ? totalScore / validators.length : 0;
  
  // IMPERATIVE HALT: score < 60% triggers halt
  const shouldHalt = gateDef.haltOnFailure && (!allPassed || averageScore < 60);

  return {
    gateId: gateDef.id,
    gateName: gateDef.name,
    status: allPassed ? 'passed' : (shouldHalt ? 'failed' : 'failed'),
    score: averageScore,
    conditions,
    halt: shouldHalt,
    fixes: shouldHalt ? generateFixes(gateDef, conditions) : [],
    metadata: {
      level: gateDef.level,
      haltOnFailure: gateDef.haltOnFailure
    }
  };
}

/**
 * Generates fix recommendations for a failed gate
 */
function generateFixes(
  gateDef: typeof GATE_DEFINITIONS.GATE_0,
  conditions: GateResult['conditions']
): string[] {
  const fixes: string[] = [];

  for (const condition of conditions) {
    if (!condition.passed) {
      fixes.push(`[${gateDef.level}] ${gateDef.name}: ${condition.message}`);
    }
  }

  // Add gate-specific guidance
  switch (gateDef.id) {
    case 'GATE-0':
      fixes.push('Ensure all required input fields are provided and valid');
      break;
    case 'GATE-1':
      fixes.push('Review skeleton extraction - core narrative elements must be identifiable');
      break;
    case 'GATE-2':
      fixes.push('thematic_law must affect world physics/economy, not only plot');
      break;
    case 'GATE-6':
      fixes.push('Grief Architecture validation failed - each stage must be on ≥2 levels');
      fixes.push('Dominant stage must be present on all 4 levels');
      break;
  }

  return fixes;
}

// ============================================================================
// GATE EXECUTION CONTROLLER
// ============================================================================

/**
 * Controls sequential gate execution
 * Handles halt conditions and state management
 */
export class GateExecutionController {
  private gates: GateResult[] = [];
  private currentGate: number = 0;
  private halted: boolean = false;
  private haltReason?: string;

  constructor() {
    this.gates = [];
    this.currentGate = 0;
    this.halted = false;
  }

  /**
   * Runs the next gate in sequence
   * Returns null if halted or complete
   */
  runNextGate(
    input: unknown,
    validators: Map<string, ((input: unknown) => { passed: boolean; score: number; message: string })[]>
  ): GateResult | null {
    if (this.halted) {
      return null;
    }

    const gateKeys = Object.keys(GATE_DEFINITIONS);
    if (this.currentGate >= gateKeys.length) {
      return null; // All gates complete
    }

    const gateKey = gateKeys[this.currentGate];
    const gateDef = GATE_DEFINITIONS[gateKey as keyof typeof GATE_DEFINITIONS];
    
    // Check prerequisites
    const prereq = validatePrerequisites(gateDef.id, this.gates);
    if (!prereq.canProceed) {
      this.halted = true;
      this.haltReason = prereq.reason;
      return null;
    }

    // Get validators for this gate
    const gateValidators = validators.get(gateDef.id) || [];
    
    // Execute gate
    const result = executeGate(gateDef.id, input, gateValidators);
    this.gates.push(result);
    this.currentGate++;

    // Check for halt condition
    if (result.halt) {
      this.halted = true;
      this.haltReason = `Gate ${gateDef.id} failed with halt condition`;
    }

    return result;
  }

  /**
   * Returns current execution state
   */
  getState(): GateSequence {
    const totalScore = this.gates.reduce((sum, g) => sum + g.score, 0) / 
                       Math.max(1, this.gates.length);

    return {
      gates: [...this.gates],
      currentGate: this.currentGate,
      halted: this.halted,
      haltReason: this.haltReason,
      totalScore
    };
  }

  /**
   * Resets execution state
   */
  reset(): void {
    this.gates = [];
    this.currentGate = 0;
    this.halted = false;
    this.haltReason = undefined;
  }

  /**
   * Skips a gate (only allowed for non-halting gates)
   */
  skipGate(gateId: string): boolean {
    const gateDef = GATE_DEFINITIONS[gateId as keyof typeof GATE_DEFINITIONS];
    if (!gateDef || gateDef.haltOnFailure) {
      return false; // Cannot skip halting gates
    }

    const skipResult: GateResult = {
      gateId: gateDef.id,
      gateName: gateDef.name,
      status: 'skipped',
      score: 0,
      conditions: [],
      halt: false,
      fixes: [],
      metadata: { skipped: true, level: gateDef.level }
    };

    this.gates.push(skipResult);
    this.currentGate++;
    return true;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a blocked status for gate prerequisite failure
 */
export function createBlockedStatus(
  reason: string,
  requiredFixes: string[],
  retryable: boolean = true
): BlockedStatus {
  return {
    blocked: true,
    reason,
    requiredFixes,
    retryable
  };
}

/**
 * Creates standardized output for gate failure
 */
export function createGateFailedOutput(
  gateResult: GateResult,
  includeBreakdown: boolean = true
): string {
  const lines: string[] = [];
  
  lines.push(`## GATE FAILED: ${gateResult.gateName}`);
  lines.push(`Status: ${gateResult.status}`);
  lines.push(`Score: ${gateResult.score.toFixed(1)}%`);
  lines.push('');

  if (includeBreakdown && gateResult.conditions.length > 0) {
    lines.push('### Condition Breakdown:');
    for (const cond of gateResult.conditions) {
      const icon = cond.passed ? '✓' : '✗';
      lines.push(`- ${icon} ${cond.message}`);
    }
    lines.push('');
  }

  if (gateResult.fixes.length > 0) {
    lines.push('### Required Fixes:');
    for (const fix of gateResult.fixes) {
      lines.push(`- ${fix}`);
    }
    lines.push('');
  }

  if (gateResult.halt) {
    lines.push('**EXECUTION HALTED** - Fix issues above before proceeding');
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { GATE_DEFINITIONS };
