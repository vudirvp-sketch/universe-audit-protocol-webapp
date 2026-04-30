/**
 * Step Registry — Maps AuditPhase → AuditStep instance.
 *
 * The registry stores all registered pipeline steps and provides
 * ordered access for the AuditStepRunner to execute them sequentially.
 *
 * Step order follows COMPLETION_PLAN Section 0.8:
 *   input_validation → mode_detection → author_profile → skeleton_extraction
 *   → screening → L1_evaluation → L2_evaluation → L3_evaluation
 *   → L4_evaluation → issue_generation → generative_modules → final_output
 *
 * Based on COMPLETION_PLAN Section 2.1 (CVA invariant: all steps share
 * the same lifecycle, variability is in prompt/parse/validate/gateCheck/reduce).
 */

import type { AuditPhase } from './types';
import type { AuditStep, PipelineRunState } from './audit-step';

// ============================================================================
// PIPELINE STEP ORDER
// ============================================================================

/**
 * The canonical execution order for pipeline steps.
 * Terminal phases (idle, complete, failed, blocked, cancelled) are NOT
 * included — they are states, not executable steps.
 *
 * Per COMPLETION_PLAN Section 0.8, "self_audit" is NOT a separate step;
 * it is merged into the L3/L4 evaluation logic. Cult potential is merged
 * into L4 evaluation. The pipeline has exactly 12 executable steps.
 */
const PIPELINE_STEP_ORDER: readonly AuditPhase[] = [
  'input_validation',
  'mode_detection',
  'author_profile',
  'skeleton_extraction',
  'screening',
  'L1_evaluation',
  'L2_evaluation',
  'L3_evaluation',
  'L4_evaluation',
  'issue_generation',
  'generative_modules',
  'final_output',
] as const;

// ============================================================================
// REGISTRY CLASS
// ============================================================================

/**
 * StepRegistry maintains a mapping from AuditPhase to AuditStep.
 *
 * Design decisions (CVA compliance, COMPLETION_PLAN Section 2.1):
 * - One registry singleton, not a factory — all steps are consumed
 *   identically by the AuditStepRunner.
 * - Steps are registered externally (not auto-discovered) so each step
 *   module owns its own configuration without coupling to the registry.
 * - The registry does NOT run steps — it only stores and retrieves them.
 *   Execution is the responsibility of the AuditStepRunner.
 */
class StepRegistry {
  /** Internal map from AuditPhase to its registered AuditStep */
  private readonly steps = new Map<AuditPhase, AuditStep>();

  /**
   * Register an audit step.
   * If a step for the same phase is already registered, it is replaced
   * (enables hot-swapping steps during development or testing).
   *
   * @param step - The AuditStep instance to register
   * @throws {Error} If step.id is not an executable pipeline phase
   */
  registerStep(step: AuditStep): void {
    if (!PIPELINE_STEP_ORDER.includes(step.id)) {
      throw new Error(
        `Cannot register step for phase "${step.id}": not a valid executable pipeline phase. ` +
        `Executable phases are: ${PIPELINE_STEP_ORDER.join(', ')}`
      );
    }
    this.steps.set(step.id, step);
  }

  /**
   * Retrieve a registered step by its phase identifier.
   *
   * @param phase - The AuditPhase to look up
   * @returns The registered AuditStep
   * @throws {Error} If no step is registered for the given phase
   */
  getStep(phase: AuditPhase): AuditStep {
    const step = this.steps.get(phase);
    if (!step) {
      throw new Error(
        `No step registered for phase "${phase}". ` +
        `Registered phases: ${Array.from(this.steps.keys()).join(', ') || '(none)'}`
      );
    }
    return step;
  }

  /**
   * Return the ordered list of pipeline phases.
   * The AuditStepRunner iterates this array to execute steps in sequence.
   *
   * @returns A readonly copy of the step order
   */
  getStepOrder(): AuditPhase[] {
    return [...PIPELINE_STEP_ORDER];
  }

  /**
   * Check whether a step has been registered for the given phase.
   *
   * @param phase - The AuditPhase to check
   * @returns true if a step is registered
   */
  hasStep(phase: AuditPhase): boolean {
    return this.steps.has(phase);
  }

  /**
   * Return the total number of registered steps.
   * Useful for progress calculation: percentComplete = (completed / total) * 100
   */
  get registeredCount(): number {
    return this.steps.size;
  }

  /**
   * Return the total number of steps in the pipeline order,
   * regardless of whether they are registered yet.
   */
  get totalSteps(): number {
    return PIPELINE_STEP_ORDER.length;
  }

  /**
   * Remove all registered steps.
   * Primarily useful for testing to reset state between test cases.
   */
  clear(): void {
    this.steps.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global step registry singleton.
 * Import this to register or retrieve audit steps.
 *
 * Usage:
 *   import { stepRegistry } from './step-registry';
 *   stepRegistry.registerStep(myStep);
 *   const step = stepRegistry.getStep('skeleton_extraction');
 */
export const stepRegistry = new StepRegistry();

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Register a step in the global registry.
 * Convenience wrapper around `stepRegistry.registerStep()`.
 */
export function registerStep(step: AuditStep): void {
  stepRegistry.registerStep(step);
}

/**
 * Get a step from the global registry by phase.
 * Convenience wrapper around `stepRegistry.getStep()`.
 *
 * @throws {Error} If no step is registered for the given phase
 */
export function getStep(phase: AuditPhase): AuditStep {
  return stepRegistry.getStep(phase);
}

/**
 * Get the ordered list of pipeline phases for sequential execution.
 * Convenience wrapper around `stepRegistry.getStepOrder()`.
 */
export function getStepOrder(): AuditPhase[] {
  return stepRegistry.getStepOrder();
}
