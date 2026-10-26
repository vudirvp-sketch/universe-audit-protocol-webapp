/**
 * Pipeline journal contract.
 *
 * The log is the only way an operator can tell a slow audit from a stuck one,
 * so it must fire at every boundary: run start, each request, each rate-limit
 * pause, each block end, and the terminal state. These tests pin the event
 * sequence against the real pipeline (only the LLM transport is mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm-client', () => ({
  createLLMClient: vi.fn(() => ({
    chatCompletionStream: vi.fn(),
    chatCompletion: vi.fn(),
  })),
  getModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
  getEffectiveModelCapabilities: vi.fn(() => ({
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsJSONMode: true,
    supportsSystemMessages: true,
  })),
}));

vi.mock('@/lib/audit/llm-streaming', () => ({
  callLLMStreaming: vi.fn(),
}));

import { runAuditPipelineV3 } from '@/lib/audit/pipeline-v3';
import { callLLMStreaming } from '@/lib/audit/llm-streaming';
import type { AuditInput, LLMConfig, PipelineLogEntry } from '@/lib/audit/types-v3';

const INPUT: AuditInput = { text: 'Город, где память продают как товар.', mediaType: 'narrative' };

const CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'test-model',
  apiKey: 'sk-test',
  rpmLimit: 60,
};

function collectedCallbacks() {
  const log: PipelineLogEntry[] = [];
  const blocks: number[] = [];
  return {
    log,
    blocks,
    callbacks: {
      onBlockStart: (block: 1 | 2 | 3 | 4 | 5) => { blocks.push(block); },
      onChunk: () => undefined,
      onBlockComplete: () => undefined,
      onError: () => undefined,
      onLog: (entry: PipelineLogEntry) => { log.push(entry); },
    },
  };
}

beforeEach(() => {
  vi.mocked(callLLMStreaming).mockReset();
  vi.mocked(callLLMStreaming).mockImplementation(async (options) => {
    const text = `## блок\n${'слово '.repeat(20)}`;
    options.onChunk(text);
    return {
      text,
      usage: { prompt: 100, completion: 200, total: 300 },
      finishReason: 'stop',
    };
  });
});

describe('pipeline journal', () => {
  it('reports every request, pause and block boundary in order', async () => {
    const { log, blocks, callbacks } = collectedCallbacks();
    const state = await runAuditPipelineV3(INPUT, CONFIG, callbacks);

    expect(state.phase).toBe('done');
    expect(log.length).toBeGreaterThan(20);

    const kinds = log.map((entry) => entry.kind);
    expect(kinds[0]).toBe('run:start');
    expect(kinds[kinds.length - 1]).toBe('run:done');

    // 13 requests in the 1+4+3+3+2 layout, 8 pauses between sub-requests.
    expect(kinds.filter((kind) => kind === 'chunk:start')).toHaveLength(13);
    expect(kinds.filter((kind) => kind === 'chunk:done')).toHaveLength(13);
    expect(kinds.filter((kind) => kind === 'rate:wait')).toHaveLength(8);
    expect(kinds.filter((kind) => kind === 'block:start')).toHaveLength(5);
    expect(kinds.filter((kind) => kind === 'block:done')).toHaveLength(5);

    // The journal is timestamped and monotonic — that is what makes it usable
    // for "the second request has been running for 4 minutes" answers.
    for (let i = 1; i < log.length; i += 1) {
      expect(log[i].at).toBeGreaterThanOrEqual(log[i - 1].at);
    }

    // Blocks are announced in order 1..5 and each start carries its own index.
    expect(blocks.filter((block, index) => blocks.indexOf(block) === index)).toEqual([1, 2, 3, 4, 5]);
    expect(log.find((entry) => entry.kind === 'block:start')?.block).toBe(1);

    // Messages carry real numbers, not placeholders.
    expect(log.find((entry) => entry.kind === 'chunk:start')?.message).toMatch(/max_tokens=\d+/);
    expect(log.find((entry) => entry.kind === 'chunk:done')?.message).toMatch(/готово за [\d.]+ с — \d+ символов/);
    expect(log.find((entry) => entry.kind === 'rate:wait')?.message).toMatch(/пауза [\d.]+ с/);
    expect(log.at(-1)?.message).toMatch(/Аудит завершён за [\d.]+ с/);
  }, 30_000);

  it('flags a truncated answer as a warning instead of reporting success', async () => {
    vi.mocked(callLLMStreaming).mockImplementation(async (options) => {
      const text = 'обрезанный ответ';
      options.onChunk(text);
      return { text, usage: null, finishReason: 'length' };
    });

    const { log, callbacks } = collectedCallbacks();
    const state = await runAuditPipelineV3(INPUT, CONFIG, callbacks);

    expect(state.phase).toBe('done');
    expect(log.filter((entry) => entry.kind === 'chunk:truncated')).toHaveLength(13);
    expect(log.filter((entry) => entry.kind === 'chunk:truncated').every((entry) => entry.level === 'warn')).toBe(true);
    expect(log.filter((entry) => entry.kind === 'block:done').every((entry) => entry.level === 'warn')).toBe(true);
  }, 30_000);

  it('explains a failure instead of leaving the last line at "request sent"', async () => {
    vi.mocked(callLLMStreaming).mockRejectedValue(new Error('401: API-ключ отклонён'));

    const { log, callbacks } = collectedCallbacks();
    const state = await runAuditPipelineV3(INPUT, CONFIG, callbacks);

    expect(state.phase).toBe('error');
    const errorEntry = log.find((entry) => entry.kind === 'run:error');
    expect(errorEntry).toBeDefined();
    expect(errorEntry?.level).toBe('error');
    expect(errorEntry?.message).toMatch(/API-ключ|Ошибка/);
  }, 30_000);
});
