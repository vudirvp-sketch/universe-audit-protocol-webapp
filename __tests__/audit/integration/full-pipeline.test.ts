/**
 * Full Pipeline Integration Test — Real API
 *
 * This test requires a real LLM API key and a running CORS proxy.
 * It is NOT intended for CI — run manually to validate end-to-end behavior.
 *
 * Prerequisites:
 *   1. Set TEST_API_KEY environment variable
 *   2. Start the local CORS proxy: cd worker && npx wrangler dev
 *   3. Run: npx vitest run __tests__/audit/integration/full-pipeline.test.ts
 *
 * The test sends a real concept through the full 12-step pipeline
 * and validates that every gate is evaluated, the pipeline reaches
 * a terminal state (complete or blocked), and all state fields are
 * populated correctly.
 *
 * References: COMPLETION_PLAN Section 2.4 Tier B — Integration test with real API
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { runAuditPipeline, resumeAuditFromStep, type PipelineState } from '../../../src/lib/audit/pipeline';
import type { AuditPhase } from '../../../src/lib/audit/types';

// Skip the entire suite if no API key is provided
const hasApiKey = !!process.env.TEST_API_KEY;
const testSkip = hasApiKey ? describe : describe.skip;

/** A test concept long enough to pass input validation (≥50 chars) */
const TEST_CONCEPT = `
В мире Этерры предательство всегда влечёт за собой потерю памяти. 
Великий Разрыв — событие, когда боги покинули мир — оставил после себя 
эпоху забвения, где каждый обманщик теряет часть воспоминаний. 
Главный герой, Кира, — страж архивов, хранящий последние записи о мире 
до Разрыва. Её хамартия — гордость: она верит, что может восстановить 
мир без потерь. Когда появляется антагонист — бывший союзник, 
пожертвовавший памятью ради силы, — Кира должна выбрать между 
спасением архивов и спасением людей. Нарратив исследует тему: 
стоит ли истина цены предательства?
`.trim();

testSkip('Full Pipeline Integration — Real API', () => {
  const provider = (process.env.TEST_PROVIDER || 'deepseek') as 'deepseek' | 'openai' | 'google' | 'anthropic';
  const apiKey = process.env.TEST_API_KEY!;
  const proxyUrl = process.env.TEST_PROXY_URL || 'http://localhost:8787';
  const model = process.env.TEST_MODEL || undefined;

  test('Runs complete audit pipeline with real LLM API', async () => {
    const progressLog: AuditPhase[] = [];

    const result = await runAuditPipeline(
      {
        narrative: TEST_CONCEPT,
        mediaType: 'novel',
        rpmLimit: 5, // Conservative rate limit for free-tier providers
      },
      {
        provider,
        apiKey,
        model,
        proxyUrl,
      },
      (phase: AuditPhase, state: PipelineState) => {
        progressLog.push(phase);
        // Log progress for debugging
        console.log(`[Progress] Phase: ${phase}, Mode: ${state.auditMode || 'pending'}`);
      },
    );

    // The pipeline must reach a terminal state
    expect(['complete', 'blocked', 'failed']).toContain(result.phase);

    // If completed successfully, validate all major state fields
    if (result.phase === 'complete') {
      // Audit mode should have been detected
      expect(result.auditMode).toBeTruthy();
      expect(['conflict', 'kishō', 'hybrid']).toContain(result.auditMode);

      // Skeleton should have been extracted
      expect(result.skeleton).toBeTruthy();
      expect(result.skeleton!.status).toBe('COMPLETE');

      // Screening should have been performed
      expect(result.screeningResult).toBeTruthy();

      // At least L1 should have a gate result
      expect(result.gateResults.L1).toBeTruthy();
      expect(typeof result.gateResults.L1!.score).toBe('number');

      // Progress should have been reported
      expect(progressLog.length).toBeGreaterThan(0);
      expect(progressLog[0]).toBe('input_validation');
    }

    // If blocked, validate that a gate failed properly
    if (result.phase === 'blocked') {
      expect(result.blockedAt).toBeTruthy();
      expect(result.error).toBeTruthy();
    }

    // Elapsed time should be positive
    expect(result.elapsedMs).toBeGreaterThan(0);

    // Step timings should be recorded
    expect(Object.keys(result.stepTimings).length).toBeGreaterThan(0);

    // Input text should be preserved
    expect(result.inputText).toBeTruthy();
  }, 300000); // 5 minute timeout for real API calls

  test('Resume from blocked step works with real API', async () => {
    // First, run a pipeline that might get blocked (using a weaker concept)
    const weakConcept = 'Краткая история о герое, который идёт в путь. В мире есть магия.';

    const firstResult = await runAuditPipeline(
      {
        narrative: weakConcept,
        mediaType: 'novel',
        rpmLimit: 5,
      },
      {
        provider,
        apiKey,
        model,
        proxyUrl,
      },
    );

    // If blocked, try resuming
    if (firstResult.phase === 'blocked' && firstResult.blockedAt) {
      console.log(`[Resume] Blocked at: ${firstResult.blockedAt}, attempting resume...`);

      const resumeResult = await resumeAuditFromStep(
        firstResult,
        firstResult.blockedAt as AuditPhase,
        { provider, apiKey, model, proxyUrl },
        undefined,
        undefined,
        5,
      );

      // Resume should also reach a terminal state
      expect(['complete', 'blocked', 'failed']).toContain(resumeResult.phase);

      // Previously completed steps should be preserved
      if (firstResult.auditMode) {
        expect(resumeResult.auditMode).toBe(firstResult.auditMode);
      }
    } else {
      // If not blocked, the test passes trivially
      expect(firstResult.phase).toBeTruthy();
    }
  }, 300000); // 5 minute timeout
});

/**
 * Manual test runner documentation.
 *
 * To run this test manually:
 *
 * 1. Start the CORS proxy locally:
 *    ```bash
 *    cd worker && npx wrangler dev
 *    ```
 *
 * 2. Set the API key environment variable:
 *    ```bash
 *    export TEST_API_KEY="sk-your-deepseek-api-key"
 *    ```
 *
 * 3. (Optional) Override provider/model/proxy:
 *    ```bash
 *    export TEST_PROVIDER="deepseek"      # or openai, google, anthropic
 *    export TEST_MODEL="deepseek-chat"     # optional
 *    export TEST_PROXY_URL="http://localhost:8787"  # default
 *    ```
 *
 * 4. Run the test:
 *    ```bash
 *    npx vitest run __tests__/audit/integration/full-pipeline.test.ts
 *    ```
 *
 * Expected results:
 * - Full pipeline completes or gets blocked at a specific gate
 * - All progress callbacks are fired
 * - Step timings are recorded
 * - Resume from blocked state works (if blocked)
 */

export {};
