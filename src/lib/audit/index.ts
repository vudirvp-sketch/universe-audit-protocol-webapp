/**
 * Universe Audit Protocol v10.0
 * Audit Module Index
 *
 * Central export for all audit modules.
 * The pipeline entry point is pipeline.ts (uses AuditStepRunner + step registry).
 * The old keyword-based orchestrator.ts has been removed.
 *
 * Dead modules removed (their logic is now in step files):
 * - cult-potential.ts → step-gate-L4.ts (cult potential merged into L4)
 * - grief-validation.ts → step-gate-L3.ts (grief check is part of L3)
 * - modes.ts → step-mode-detection.ts (mode detection via LLM)
 * - gate-executor.ts → gateCheck in each step (CVA-based)
 * - input-validator.ts → step-validate.ts (pure client-side validation)
 * - author-profile.ts → step-author-profile.ts + scoring-algorithm.ts
 * - skeleton-extraction.ts → step-skeleton.ts (LLM-based extraction)
 * - what-for-chain.ts → step-issues-chains.ts (chain analysis via LLM)
 * - media-transformation.ts → handled per-step in buildPrompt
 * - generative-templates.ts → step-generative.ts (generative modules via LLM)
 * - diagnostics.ts → step-final.ts (diagnostics as part of final step)
 * - level-assignment.ts → step-final.ts (classification in final step)
 */

// TIER 0 — Foundation (types and data)
export * from './types';
export * from './protocol-data';
export * from './issue-schema';
export * from './scoring-algorithm';
export * from './prompts';

// TIER 1 — Client Pipeline Infrastructure
export * from './audit-step';
export * from './step-registry';
export * from './pipeline';
export * from './json-sanitizer';
export * from './input-sanitizer';
export * from './error-handler';
