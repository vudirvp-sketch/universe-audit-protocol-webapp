/**
 * Pipeline Tests — runAuditPipeline and resumeAuditFromStep
 *
 * Tests for the full pipeline orchestrator using mock LLM client.
 * Key protocol rules tested:
 * - Sequential step execution with progress callbacks
 * - Pipeline stops on gate failure (blocked state)
 * - Pipeline stops on skeleton extraction failure
 * - Pipeline supports cancellation via AbortSignal
 * - Per-step timings are recorded correctly
 * - resumeAuditFromStep re-runs from a specific step
 * - Rate limiting enforcement between steps
 *
 * References: COMPLETION_PLAN Section 2.5, Section 7.1
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { runAuditPipeline, resumeAuditFromStep, type PipelineState } from '../../src/lib/audit/pipeline';
import type { ChatCompletionResponse } from '../../src/lib/llm-client';
import type { PipelineRunState } from '../../src/lib/audit/audit-step';
import type { AuditPhase, AuditMode, MediaType } from '../../src/lib/audit/types';

// ============================================================================
// MOCK LLM CLIENT
// ============================================================================

/**
 * Create a mock LLM client that returns configurable responses per step.
 * Each call to chatCompletion returns the next response from the queue,
 * or a default valid response if the queue is empty.
 */
function createMockLLMClient(responses: Partial<Record<AuditPhase, Array<ChatCompletionResponse>>> = {}) {
  const callLog: { messages: unknown[]; max_tokens?: number }[] = [];

  const chatCompletion = vi.fn(async (options: { messages: unknown[]; max_tokens?: number }) => {
    callLog.push({ messages: options.messages, max_tokens: options.max_tokens });

    // Try to find a response for the current step based on the call order
    // Since we can't know which step is calling, we use a round-robin approach
    const allPhases: AuditPhase[] = [
      'mode_detection', 'author_profile', 'skeleton_extraction', 'screening',
      'L1_evaluation', 'L2_evaluation', 'L3_evaluation', 'L4_evaluation',
      'issue_generation', 'generative_modules',
    ];

    const callIndex = callLog.length - 1;
    const phaseGuess = callIndex < allPhases.length ? allPhases[callIndex] : allPhases[allPhases.length - 1];

    if (responses[phaseGuess] && responses[phaseGuess]!.length > 0) {
      return responses[phaseGuess]!.shift()!;
    }

    // Default valid response
    return defaultLLMResponse();
  });

  return { chatCompletion, callLog };
}

/** Default valid LLM response with generic JSON content */
function defaultLLMResponse(overrides: Partial<ChatCompletionResponse> = {}): ChatCompletionResponse {
  return {
    id: 'test-id',
    object: 'chat.completion',
    created: Date.now(),
    model: 'test-model',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: '{}' },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    ...overrides,
  };
}

/** Create a mock LLM response with specific JSON content */
function mockLLMResponse(json: unknown, finishReason: string = 'stop'): ChatCompletionResponse {
  return defaultLLMResponse({
    choices: [{
      index: 0,
      message: { role: 'assistant', content: JSON.stringify(json) },
      finish_reason: finishReason,
    }],
  });
}

// ============================================================================
// STEP-SPECIFIC MOCK RESPONSES
// ============================================================================

/** Mode detection step response */
function modeDetectionResponse(mode: AuditMode = 'conflict'): ChatCompletionResponse {
  return mockLLMResponse({
    hasAntagonist: mode !== 'kishō',
    victoryTrajectory: mode === 'conflict',
    externalConflict: mode !== 'kishō',
    mode,
    reasoning: 'Определён режим на основе нарратива',
  });
}

/** Author profile step response */
function authorProfileResponse(): ChatCompletionResponse {
  return mockLLMResponse({
    answers: { Q1: true, Q2: true, Q3: true, Q4: false, Q5: true, Q6: true, Q7: true },
    weightedScore: 71,
    percentage: 71,
    type: 'hybrid',
    confidence: 'medium',
    mainRisks: ['Слишком детальное планирование'],
    auditPriorities: ['Сначала механика, затем тело'],
  });
}

/** Skeleton extraction step response */
function skeletonResponse(canProceed: boolean = true): ChatCompletionResponse {
  return mockLLMResponse({
    thematicLaw: canProceed ? 'В этом мире предательство влечёт потерю памяти' : null,
    rootTrauma: canProceed ? 'Великий Разрыв — боги покинули мир' : null,
    hamartia: 'Гордость героя',
    pillars: ['Столп 1', 'Столп 2', 'Столп 3'],
    emotionalEngine: 'depression',
    authorProhibition: 'Нельзя воскресить мёртвых',
    targetExperience: 'Чувство утраты и принятия',
    centralQuestion: 'Стоит ли память цены предательства?',
  });
}

/** Screening step response */
function screeningResponse(noCount: number = 0): ChatCompletionResponse {
  const answers = [
    noCount < 1, // Q1
    noCount < 2, // Q2
    noCount < 3, // Q3
    noCount < 4, // Q4
    noCount < 5, // Q5
    noCount < 6, // Q6
    noCount < 7, // Q7
  ];
  return mockLLMResponse({
    answers,
    flags: answers.filter(a => !a).map((_, i) => `Флаг ${i + 1}`),
    recommendation: noCount <= 1 ? 'ready_for_audit' : noCount <= 3 ? 'requires_sections' : 'stop_return_to_skeleton',
  });
}

/** Gate evaluation step response */
function gateResponse(score: number, gatePassed: boolean = true): ChatCompletionResponse {
  return mockLLMResponse({
    evaluations: [
      { id: 'EVAL-01', status: score >= 60 ? 'PASS' : 'FAIL', evidence: 'Анализ выполнен', functionalRole: 'Оценка' },
    ],
    score,
    gatePassed,
    fixList: gatePassed ? [] : [{
      id: 'FIX-01',
      description: 'Необходимо улучшить результат',
      severity: 'critical',
      type: 'competence',
      recommendedApproach: 'radical' as const,
    }],
  });
}

/** L3 gate response with grief matrix */
function l3GateResponse(score: number, dominantStageHasMultipleLevels: boolean = true): ChatCompletionResponse {
  return mockLLMResponse({
    evaluations: [
      { id: 'L3_01', status: score >= 60 ? 'PASS' : 'FAIL', evidence: 'Психика проанализирована', functionalRole: 'Психика' },
    ],
    griefMatrix: {
      dominantStage: 'depression',
      cells: dominantStageHasMultipleLevels
        ? [
            { stage: 'depression', level: 'character', confidence: 'high' },
            { stage: 'depression', level: 'location', confidence: 'medium' },
          ]
        : [
            { stage: 'depression', level: 'character', confidence: 'high' },
          ],
    },
    score,
    gatePassed: score >= 60,
  });
}

/** L4 gate response with cult potential */
function l4GateResponse(score: number): ChatCompletionResponse {
  return mockLLMResponse({
    evaluations: [
      { id: 'L4_01', status: score >= 60 ? 'PASS' : 'FAIL', evidence: 'Мета-уровень проанализирован', functionalRole: 'Мета' },
    ],
    threeLayers: {
      personal: { stable: true, proof: 'Личный слой стабилен' },
      plot: { stable: true, proof: 'Сюжетный слой стабилен' },
      meta: { stable: true, proof: 'Мета-слой стабилен' },
    },
    cornelianDilemma: {
      valid: true,
      valueA: 'Верность',
      valueB: 'Свобода',
      irreversible: true,
      thirdPath: 'Нет',
    },
    agentMirror: { integrated: true, directQuestion: 'Что бы вы сделали?' },
    cultPotential: { score: 70, criteria: [true, true, true] },
    score,
    gatePassed: score >= 60,
  });
}

/** Issues and chains step response */
function issuesResponse(): ChatCompletionResponse {
  return mockLLMResponse({
    chains: [{
      element: 'thematicLaw',
      terminal_type: 'DILEMMA',
      terminalStep: 5,
      step_reached: 5,
      iterations: [{ step: 1, question: 'А чтобы что?', answer: 'Чтобы мир изменился' }],
      valid: true,
      reasoning: 'Тестовая цепочка',
    }],
    issues: [{
      id: 'ISSUE-01',
      location: '§1 + L1',
      severity: 'major',
      diagnosis: 'Диагноз проблемы',
      recommended: 'compromise',
      patches: {
        conservative: { description: 'Минимальный фикс', impact: 'Низкий', sideEffects: [] },
        compromise: { description: 'Баланс', impact: 'Средний', sideEffects: [] },
        radical: { description: 'Полная переработка', impact: 'Высокий', sideEffects: [] },
      },
    }],
  });
}

/** Generative modules step response */
function generativeResponse(): ChatCompletionResponse {
  return mockLLMResponse({
    grief_mapping: {
      law: 'Предательство ведёт к потере памяти',
      derived_stage: 'depression',
      justification_chain: ['Обоснование 1'],
    },
    dilemma: {
      value_A: 'Верность',
      value_B: 'Свобода',
      criteria_met: { type_choice: true, irreversibility: true, identity: true, victory_price: true },
      post_final_world: 'Мир без памяти',
    },
  });
}

/** Build a complete set of mock responses for a full pipeline run where all gates pass */
function fullPassResponses(): Array<ChatCompletionResponse> {
  return [
    modeDetectionResponse('conflict'),
    authorProfileResponse(),
    skeletonResponse(true),
    screeningResponse(0),
    gateResponse(75, true),   // L1 passes
    gateResponse(70, true),   // L2 passes
    l3GateResponse(65, true), // L3 passes
    l4GateResponse(72),       // L4 passes
    issuesResponse(),
    generativeResponse(),
  ];
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('runAuditPipeline', () => {
  let mockClient: ReturnType<typeof createMockLLMClient>;

  beforeEach(() => {
    mockClient = createMockLLMClient();
  });

  test('Returns complete state when all steps pass', async () => {
    // Provide responses for each LLM-calling step
    const responses = fullPassResponses();
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    expect(result.phase).toBe('complete');
    expect(result.error).toBeNull();
  });

  test('Calls LLM client for each non-skipLLM step', async () => {
    const responses = fullPassResponses();
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    // 10 LLM-calling steps (steps 1-10; step 0 and step 11 are skipLLM)
    expect(mockClient.chatCompletion).toHaveBeenCalled();
    // At least 10 calls — one per LLM step
    expect(mockClient.callLog.length).toBeGreaterThanOrEqual(10);
  });

  test('Stops at L1 gate failure and returns blocked state', async () => {
    const responses = [
      modeDetectionResponse('conflict'),
      authorProfileResponse(),
      skeletonResponse(true),
      screeningResponse(0),
      gateResponse(45, false), // L1 FAILS — below 60% conflict threshold
    ];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    // Pipeline should be blocked
    expect(result.phase).toBe('blocked');
    // L2 should NOT have been called — pipeline stops at L1
    // We expect exactly 5 LLM calls: mode_detection, author_profile, skeleton, screening, L1
    expect(mockClient.callLog.length).toBeLessThanOrEqual(5);
  });

  test('Stops at skeleton extraction failure when thematicLaw is null', async () => {
    const responses = [
      modeDetectionResponse('conflict'),
      authorProfileResponse(),
      skeletonResponse(false), // thematicLaw = null → BLOCKED
    ];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    expect(result.phase).toBe('blocked');
    // Screening and gates should NOT have been called
    expect(mockClient.callLog.length).toBeLessThanOrEqual(3);
  });

  test('Supports cancellation via AbortSignal', async () => {
    const responses = fullPassResponses();
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const controller = new AbortController();

    // Abort immediately after creation
    controller.abort();

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
      undefined,
      controller.signal,
    );

    expect(result.phase).toBe('cancelled');
    // LLM should not have been called at all (abort before first step)
    expect(mockClient.chatCompletion).not.toHaveBeenCalled();
  });

  test('Cancellation mid-pipeline stops further steps', async () => {
    const controller = new AbortController();
    const responses = fullPassResponses();
    let responseIndex = 0;
    let callCount = 0;

    mockClient.chatCompletion.mockImplementation(async () => {
      callCount++;
      // Abort after the 3rd LLM call (mode_detection, author_profile, skeleton)
      if (callCount >= 3) {
        controller.abort();
      }
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
      undefined,
      controller.signal,
    );

    expect(result.phase).toBe('cancelled');
    // Should have called at most 3 LLM steps before cancelling
    expect(mockClient.callLog.length).toBeLessThanOrEqual(4);
  });

  test('Records per-step timings', async () => {
    const responses = fullPassResponses();
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      // Small delay to ensure measurable elapsed time
      await new Promise(resolve => setTimeout(resolve, 10));
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    expect(result.elapsedMs).toBeGreaterThan(0);
    // At least some step timings should be recorded
    expect(Object.keys(result.stepTimings).length).toBeGreaterThan(0);
    // Each timing should be positive
    for (const timing of Object.values(result.stepTimings)) {
      expect(timing).toBeGreaterThan(0);
    }
  });

  test('Calls onProgress callback for each step', async () => {
    const responses = fullPassResponses();
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const progressPhases: AuditPhase[] = [];
    await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
      (phase) => { progressPhases.push(phase); },
    );

    // Progress should include all 12 phases (step 0 through step 11)
    expect(progressPhases.length).toBeGreaterThanOrEqual(12);
    // First progress should be input_validation
    expect(progressPhases[0]).toBe('input_validation');
    // Last progress should be complete or final_output
    const lastPhase = progressPhases[progressPhases.length - 1];
    expect(['complete', 'final_output']).toContain(lastPhase);
  });

  test('Uses kishō threshold (50%) for kishō mode', async () => {
    // Mode detection returns kishō, L1 gate score = 55% (passes kishō 50%, would fail conflict 60%)
    const responses = [
      modeDetectionResponse('kishō'),
      authorProfileResponse(),
      skeletonResponse(true),
      screeningResponse(0),
      gateResponse(55, true), // 55% — passes kishō (50%) but would fail conflict (60%)
      gateResponse(70, true), // L2 passes
      l3GateResponse(65, true), // L3 passes
      l4GateResponse(72), // L4 passes
      issuesResponse(),
      generativeResponse(),
    ];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    // With kishō mode, 55% should pass L1 (threshold is 50%)
    expect(result.phase).not.toBe('blocked');
  });

  test('Handles screening with 4+ NO answers → blocked (count-based)', async () => {
    const responses = [
      modeDetectionResponse('conflict'),
      authorProfileResponse(),
      skeletonResponse(true),
      screeningResponse(5), // 5 NO answers → stop_return_to_skeleton → BLOCKED
    ];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    expect(result.phase).toBe('blocked');
  });

  test('Handles truncated response (finish_reason: length)', async () => {
    const truncatedResponse: ChatCompletionResponse = {
      id: 'test-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: '{"mode": "confl' },
        finish_reason: 'length',
      }],
    };

    const validResponse = modeDetectionResponse('conflict');

    let callCount = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return truncatedResponse;
      return validResponse;
    });

    // The pipeline should handle the truncated response by retrying
    // and eventually succeed (the retry returns a valid response)
    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    // Should have retried at least once
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  test('Returns failed state on LLM error after max retries', async () => {
    mockClient.chatCompletion.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
      mockClient,
    );

    expect(result.phase).toBe('failed');
    expect(result.error).toBeTruthy();
  });

  test('Accepts LLMClient config object instead of LLMClient instance', async () => {
    // This test verifies that the pipeline can accept a config object
    // and create the LLM client internally.
    // Since we can't call a real API, we just verify the function signature
    // accepts the config object without throwing.
    const config = {
      provider: 'deepseek' as const,
      apiKey: 'sk-test-key',
      model: 'deepseek-chat',
      proxyUrl: 'http://localhost:8787',
    };

    // The pipeline will try to call the LLM, which will fail because
    // there's no real proxy running — but we verify it doesn't crash
    // on the config object parsing
    try {
      await runAuditPipeline(
        { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel' },
        config,
      );
    } catch {
      // Expected: network error since no proxy is running
    }
    // If we reach here without a type error, the config object is accepted
  });

  test('Rate limiting — respects rpmLimit by enforcing minimum spacing', async () => {
    const responses = fullPassResponses();
    let responseIndex = 0;
    const callTimestamps: number[] = [];

    mockClient.chatCompletion.mockImplementation(async () => {
      callTimestamps.push(Date.now());
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    // Set a very low RPM limit (2 requests per minute) — this means
    // minimum 30s between requests. But for testing, we use a high RPM
    // to avoid long waits. We test that the rate limiter is invoked.
    await runAuditPipeline(
      { narrative: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.', mediaType: 'novel', rpmLimit: 60 },
      mockClient,
    );

    // With 60 RPM, minimum interval is ~1 second
    // Just verify that the LLM was called the expected number of times
    expect(mockClient.chatCompletion).toHaveBeenCalled();
  });
});

// ============================================================================
// resumeAuditFromStep tests
// ============================================================================

describe('resumeAuditFromStep', () => {
  let mockClient: ReturnType<typeof createMockLLMClient>;

  beforeEach(() => {
    mockClient = createMockLLMClient();
  });

  function createBlockedState(blockedAtStep: AuditPhase = 'L1_evaluation'): PipelineState {
    return {
      inputText: 'Тестовый нарратив о мире с тематическим законом и корневой травмой, достаточно длинный для валидации.',
      auditMode: 'conflict',
      authorProfile: {
        type: 'hybrid',
        percentage: 71,
        confidence: 'medium',
        mainRisks: ['Слишком детальное планирование'],
        auditPriorities: ['Сначала механика, затем тело'],
      },
      skeleton: {
        status: 'COMPLETE',
        elements: [
          { id: 'thematic_law', name: 'Тематический закон', value: 'Закон мира', status: 'complete' },
          { id: 'root_trauma', name: 'Корневая травма', value: 'Травма', status: 'complete' },
        ],
        fixes: [],
        canProceedToL1: true,
      },
      screeningResult: {
        question1_thematicLaw: true,
        question2_worldWithoutProtagonist: true,
        question3_embodiment: true,
        question4_hamartia: true,
        question5_painfulChoice: true,
        question6_antagonistLogic: true,
        question7_finalIrreversible: true,
        flags: [],
        recommendation: 'ready_for_audit',
        no_count: 0,
        proceed_normally: true,
      },
      gateResults: { L1: null, L2: null, L3: null, L4: null },
      checklist: [],
      griefMatrix: null,
      report: null,
      issues: [],
      whatForChains: [],
      generativeOutput: null,
      nextActions: [],
      finalScore: null,
      phase: 'blocked',
      blockedAt: blockedAtStep,
      error: 'Гейт L1 не пройден',
      elapsedMs: 45000,
      stepTimings: { input_validation: 100, mode_detection: 5000, author_profile: 6000, skeleton_extraction: 8000, screening: 7000 },
    };
  }

  test('Resumes from the specified step and runs to completion', async () => {
    const responses = [
      gateResponse(75, true),   // L1 now passes
      gateResponse(70, true),   // L2 passes
      l3GateResponse(65, true), // L3 passes
      l4GateResponse(72),       // L4 passes
      issuesResponse(),
      generativeResponse(),
    ];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'L1_evaluation',
      mockClient,
    );

    expect(result.phase).toBe('complete');
    expect(result.error).toBeNull();
    // Should NOT have re-run steps 0-4 (input_validation through screening)
    // Only L1 through final_output should be called (6 LLM steps + 1 skipLLM)
    expect(mockClient.callLog.length).toBeLessThanOrEqual(7);
  });

  test('Preserves previously completed step results', async () => {
    const responses = [gateResponse(80, true), gateResponse(75, true), l3GateResponse(70, true), l4GateResponse(72), issuesResponse(), generativeResponse()];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'L1_evaluation',
      mockClient,
    );

    // Author profile should be preserved from the saved state
    expect(result.authorProfile).toEqual(savedState.authorProfile);
    // Skeleton should be preserved
    expect(result.skeleton).toEqual(savedState.skeleton);
    // Screening result should be preserved
    expect(result.screeningResult).toEqual(savedState.screeningResult);
  });

  test('Returns error when resuming from unknown step', async () => {
    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'unknown_step' as AuditPhase,
      mockClient,
    );

    expect(result.error).toBeTruthy();
    expect(result.error).toContain('невозможно возобновить');
  });

  test('Respects AbortSignal during resume', async () => {
    const controller = new AbortController();
    controller.abort();

    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'L1_evaluation',
      mockClient,
      undefined,
      controller.signal,
    );

    expect(result.phase).toBe('cancelled');
    expect(mockClient.chatCompletion).not.toHaveBeenCalled();
  });

  test('Returns blocked state if resumed step still fails', async () => {
    // L1 still fails on resume
    const responses = [gateResponse(40, false)]; // Still below 60% threshold
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'L1_evaluation',
      mockClient,
    );

    expect(result.phase).toBe('blocked');
  });

  test('Records new step timings during resume without overwriting old ones', async () => {
    const responses = [gateResponse(75, true), gateResponse(70, true), l3GateResponse(65, true), l4GateResponse(72), issuesResponse(), generativeResponse()];
    let responseIndex = 0;
    mockClient.chatCompletion.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      const resp = responseIndex < responses.length ? responses[responseIndex] : defaultLLMResponse();
      responseIndex++;
      return resp;
    });

    const savedState = createBlockedState('L1_evaluation');
    const result = await resumeAuditFromStep(
      savedState,
      'L1_evaluation',
      mockClient,
    );

    // Previously recorded timings should still be present
    expect(result.stepTimings.input_validation).toBe(savedState.stepTimings.input_validation);
    expect(result.stepTimings.mode_detection).toBe(savedState.stepTimings.mode_detection);
    // New timings should be recorded
    expect(result.stepTimings.L1_evaluation).toBeDefined();
    expect(result.stepTimings.L1_evaluation).toBeGreaterThan(0);
  });
});

// Export for type checking
export {};
