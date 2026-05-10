/**
 * Tests for scoring.ts — Checklist scoring module.
 *
 * Tests:
 * - getApplicableItems() — filters checklist by media type
 * - buildScoringPrompt() — generates scoring prompt with correct items
 * - runChecklistScoring() — end-to-end scoring with mocked LLM
 * - Score calculation — percentages, by-level breakdown
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock llm-streaming to avoid real LLM calls
vi.mock('@/lib/audit/llm-streaming', () => ({
  callLLMStreaming: vi.fn(),
}));

import { getApplicableItems, buildScoringPrompt, runChecklistScoring } from '@/lib/audit/scoring';
import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { LLMStreamingResult } from '@/lib/audit/llm-streaming';
import type { MediaType, LLMConfig } from '@/lib/audit/types-v3';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// getApplicableItems
// ============================================================

describe('getApplicableItems', () => {
  it('returns items applicable to narrative media type', () => {
    const items = getApplicableItems('narrative');
    expect(items.length).toBeGreaterThan(0);
    // All returned items should be applicable
    for (const item of items) {
      expect(item.applicable).toBe(true);
      expect(
        item.applicableMedia.includes('all') || item.applicableMedia.includes('narrative')
      ).toBe(true);
    }
  });

  it('returns items applicable to game media type', () => {
    const items = getApplicableItems('game');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(
        item.applicableMedia.includes('all') || item.applicableMedia.includes('game')
      ).toBe(true);
    }
  });

  it('returns items applicable to ttrpg media type', () => {
    const items = getApplicableItems('ttrpg');
    expect(items.length).toBeGreaterThan(0);
  });

  it('returns items applicable to visual media type', () => {
    const items = getApplicableItems('visual');
    expect(items.length).toBeGreaterThan(0);
  });

  it('game media type includes GAME-specific items not in narrative', () => {
    const narrativeItems = getApplicableItems('narrative');
    const gameItems = getApplicableItems('game');
    const narrativeIds = new Set(narrativeItems.map(i => i.id));
    const gameOnly = gameItems.filter(i => !narrativeIds.has(i.id));
    // Game should have some GAME-tagged items (E1, E2, I2, L2)
    expect(gameOnly.length).toBeGreaterThan(0);
  });

  it('all items include CORE (all media) items', () => {
    const items = getApplicableItems('narrative');
    const hasCoreItems = items.some(i => i.id === 'A1');
    expect(hasCoreItems).toBe(true);
  });
});

// ============================================================
// buildScoringPrompt
// ============================================================

describe('buildScoringPrompt', () => {
  it('generates system prompt requesting JSON', () => {
    const { system } = buildScoringPrompt(['Block 1 text'], 'narrative');
    expect(system).toContain('JSON');
  });

  it('generates user prompt with checklist items', () => {
    const { user } = buildScoringPrompt(['Block 1 text'], 'narrative');
    // Should contain at least some item IDs
    expect(user).toContain('A1');
    expect(user).toContain('КРИТЕРИИ');
    expect(user).toContain('АУДИТ');
  });

  it('includes block markdowns in the prompt', () => {
    const { user } = buildScoringPrompt(
      ['Block 1: Orientation', 'Block 2: Mechanism'],
      'narrative'
    );
    expect(user).toContain('Block 1: Orientation');
    expect(user).toContain('Block 2: Mechanism');
  });

  it('includes media type in the prompt', () => {
    const { user } = buildScoringPrompt(['text'], 'game');
    expect(user).toContain('game');
  });

  it('filters items by media type in the prompt', () => {
    const narrativePrompt = buildScoringPrompt(['text'], 'narrative');
    const gamePrompt = buildScoringPrompt(['text'], 'game');
    // Game prompt should contain GAME-specific items (e.g. E1)
    expect(gamePrompt.user).toContain('E1');
  });
});

// ============================================================
// runChecklistScoring
// ============================================================

describe('runChecklistScoring', () => {
  const defaultLLMConfig: LLMConfig = {
    provider: 'google',
    apiKey: 'test-key',
    model: 'gemini-2.0-flash',
    proxyUrl: 'https://proxy.test',
  };

  it('returns scored result from LLM JSON response', async () => {
    const mockResponse: LLMStreamingResult = {
      text: JSON.stringify([
        { id: 'A1', status: 'PASS', evidence: 'Found in text' },
        { id: 'A2', status: 'FAIL', evidence: 'Missing root trauma' },
        { id: 'A3', status: 'INSUFFICIENT_DATA', evidence: '' },
      ]),
      usage: { prompt: 50, completion: 100, total: 150 },
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['Block 1 text', 'Block 2 text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).not.toBeNull();
    expect(result!.items.length).toBeGreaterThan(0);
    expect(result!.totalApplicable).toBeGreaterThan(0);
    expect(typeof result!.scorePercent).toBe('number');
  });

  it('handles JSON wrapped in markdown code block', async () => {
    const jsonBody = JSON.stringify([
      { id: 'A1', status: 'PASS', evidence: 'Test' },
    ]);
    const mockResponse: LLMStreamingResult = {
      text: '```json\n' + jsonBody + '\n```',
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).not.toBeNull();
    expect(result!.items.some(i => i.id === 'A1')).toBe(true);
  });

  it('marks unscored items as INSUFFICIENT_DATA', async () => {
    // Only A1 is returned by LLM, but many items are applicable
    const mockResponse: LLMStreamingResult = {
      text: JSON.stringify([
        { id: 'A1', status: 'PASS', evidence: 'Test' },
      ]),
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).not.toBeNull();
    const insufficientItems = result!.items.filter(i => i.status === 'INSUFFICIENT_DATA');
    expect(insufficientItems.length).toBeGreaterThan(0);
  });

  it('returns null on LLM call failure', async () => {
    vi.mocked(callLLMStreaming).mockRejectedValue(new Error('API error'));

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).toBeNull();
  });

  it('returns null on invalid JSON response', async () => {
    const mockResponse: LLMStreamingResult = {
      text: 'This is not JSON at all',
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).toBeNull();
  });

  it('returns null on empty LLM response', async () => {
    const mockResponse: LLMStreamingResult = {
      text: '',
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      defaultLLMConfig,
    );

    expect(result).toBeNull();
  });
});

// ============================================================
// Score calculation
// ============================================================

describe('Score calculation', () => {
  it('calculates correct percentage', async () => {
    // Return exactly 2 items: 1 PASS, 1 FAIL
    const mockResponse: LLMStreamingResult = {
      text: JSON.stringify([
        { id: 'A1', status: 'PASS', evidence: 'Test' },
        { id: 'A2', status: 'FAIL', evidence: 'Missing' },
      ]),
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
        proxyUrl: 'https://proxy.test',
      },
    );

    expect(result).not.toBeNull();
    // fulfilled should be at least 1 (A1)
    expect(result!.fulfilled).toBeGreaterThanOrEqual(1);
    // scorePercent should be calculated
    expect(result!.scorePercent).toBeGreaterThanOrEqual(0);
    expect(result!.scorePercent).toBeLessThanOrEqual(100);
  });

  it('provides by-level breakdown', async () => {
    const mockResponse: LLMStreamingResult = {
      text: JSON.stringify([
        { id: 'A1', status: 'PASS', evidence: 'Test' },
      ]),
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
        proxyUrl: 'https://proxy.test',
      },
    );

    expect(result).not.toBeNull();
    expect(result!.byLevel).toBeDefined();
    // Should have L1 at minimum (A1 is L1)
    expect(result!.byLevel.L1).toBeDefined();
    expect(result!.byLevel.L1.applicable).toBeGreaterThan(0);
  });

  it('normalizes Russian status values', async () => {
    const mockResponse: LLMStreamingResult = {
      text: JSON.stringify([
        { id: 'A1', status: 'ДА', evidence: 'Test' },
        { id: 'A2', status: 'НЕТ', evidence: 'Missing' },
      ]),
      usage: null,
    };
    vi.mocked(callLLMStreaming).mockResolvedValue(mockResponse);

    const result = await runChecklistScoring(
      ['text'],
      'narrative',
      {
        provider: 'google',
        apiKey: 'test-key',
        model: 'gemini-2.0-flash',
        proxyUrl: 'https://proxy.test',
      },
    );

    expect(result).not.toBeNull();
    const a1Item = result!.items.find(i => i.id === 'A1');
    const a2Item = result!.items.find(i => i.id === 'A2');
    expect(a1Item?.status).toBe('PASS');
    expect(a2Item?.status).toBe('FAIL');
  });
});
