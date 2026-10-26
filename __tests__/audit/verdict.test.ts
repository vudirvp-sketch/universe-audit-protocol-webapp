/**
 * Tests for verdict.ts — extraction of the UNIVERSE_AUDIT_PROTOCOL_ULTIMATE_v16
 * §26.S / §27 verdict from Block 5 markdown.
 *
 * The function must never throw on malformed LLM output: a broken JSON block
 * degrades to the markdown band lines, and unusable text returns null.
 */
import { describe, it, expect } from 'vitest';
import { extractAuditVerdict } from '@/lib/audit/verdict';

// ============================================================
// Fixtures
// ============================================================

const VALID_JSON = `{
  "final_verdict": {
    "overall_state": "viable",
    "confidence": "Mixed",
    "world_foundation": "Coherent",
    "systemic_depth": "developing",
    "human_integration": "weak",
    "experiential_integration": "developing",
    "story_capacity": "focused",
    "identity": "emerging"
  },
  "issues": [
    { "id": "ISSUE-01", "class": "CAUSAL", "diagnosis": "Экономика памяти не замкнута", "confidence": "high" },
    { "class": "NO-ID" },
    "not-an-object",
    { "id": "ISSUE-02", "class": "CULTURAL", "diagnosis": "Культура не специфична", "confidence": "medium" }
  ],
  "recommendations": [
    { "priority": 3, "problem": "Замкнуть экономику памяти", "intervention_class": "CONNECTIVE" },
    { "problem": "Добавить обыденные сцены", "intervention_class": "LOCAL" }
  ],
  "capability_frontier": {
    "demonstrated": ["a", "b"],
    "under_proven": ["c"],
    "latent": [],
    "new_primitive_required": ["d", "e", "f"],
    "experimental": ["g"],
    "deferred": [],
    "contradicted_or_should_not_add": ["h", "i", "j", "k"]
  }
}`;

const CLOSING = `> **Что мир уже может** — держать экономику памяти и показывать цену сделки; чего не может — показать обыденную жизнь вне сюжета; одна правка — сцена возврата памяти.`;

const BLOCK_5 = `## S. Итоговый вердикт

ОСНОВА МИРА: coherent
СИСТЕМНАЯ ГЛУБИНА: developing
УВЕРЕННОСТЬ: mixed

${CLOSING}

\`\`\`json
${VALID_JSON}
\`\`\`
`;

// ============================================================
// JSON branch
// ============================================================

describe('extractAuditVerdict — JSON', () => {
  it('maps final_verdict to 7 bands in the fixed §26.S order', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict).not.toBeNull();
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands.map((band) => band.key)).toEqual([
      'world_foundation',
      'systemic_depth',
      'human_integration',
      'experiential_integration',
      'story_capacity',
      'identity',
      'overall_state',
    ]);
    expect(verdict?.bands.map((band) => band.label)).toEqual([
      'Фундамент мира',
      'Системная глубина',
      'Человеческая интеграция',
      'Опытная интеграция',
      'Ёмкость историй',
      'Идентичность',
      'Общее состояние',
    ]);
    expect(verdict?.bands[0].value).toBe('coherent');
  });

  it('extracts confidence but never as a band', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict?.confidence).toBe('mixed');
    expect(verdict?.bands.some((band) => band.key === ('confidence' as never))).toBe(false);
    expect(verdict?.bands).toHaveLength(7);
  });

  it('maps issues, keeping only object entries with an id', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict?.issues).toEqual([
      {
        id: 'ISSUE-01',
        failureClass: 'CAUSAL',
        diagnosis: 'Экономика памяти не замкнута',
        confidence: 'high',
      },
      {
        id: 'ISSUE-02',
        failureClass: 'CULTURAL',
        diagnosis: 'Культура не специфична',
        confidence: 'medium',
      },
    ]);
  });

  it('maps recommendations and falls back to index+1 for missing priority', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict?.recommendations).toEqual([
      { priority: 3, problem: 'Замкнуть экономику памяти', interventionClass: 'CONNECTIVE' },
      { priority: 2, problem: 'Добавить обыденные сцены', interventionClass: 'LOCAL' },
    ]);
  });

  it('counts the 7 capability frontier buckets', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict?.frontier).toEqual({
      demonstrated: 2,
      under_proven: 1,
      latent: 0,
      new_primitive_required: 3,
      experimental: 1,
      deferred: 0,
      contradicted_or_should_not_add: 4,
    });
  });

  it('returns frontier: null when capability_frontier is absent', () => {
    const verdict = extractAuditVerdict(
      '```json\n{ "final_verdict": { "world_foundation": "coherent" } }\n```',
    );
    expect(verdict?.frontier).toBeNull();
    expect(verdict?.bands).toHaveLength(1);
  });

  it('counts missing or non-array frontier buckets as 0', () => {
    const verdict = extractAuditVerdict(
      '```json\n{ "final_verdict": { "identity": "distinct" }, "capability_frontier": { "demonstrated": ["x"], "latent": "nope", "experimental": 7 } }\n```',
    );
    expect(verdict?.frontier).toEqual({
      demonstrated: 1,
      under_proven: 0,
      latent: 0,
      new_primitive_required: 0,
      experimental: 0,
      deferred: 0,
      contradicted_or_should_not_add: 0,
    });
  });

  it('skips empty and non-string band values', () => {
    const verdict = extractAuditVerdict(
      '```json\n{ "final_verdict": { "world_foundation": "coherent", "identity": "", "overall_state": 42, "confidence": null } }\n```',
    );
    expect(verdict?.bands.map((band) => band.key)).toEqual(['world_foundation']);
    expect(verdict?.confidence).toBeNull();
  });

  it('tolerates a BOM and leading/trailing prose', () => {
    const verdict = extractAuditVerdict(`\uFEFFПролог.\n\n\`\`\`json\n${VALID_JSON}\n\`\`\`\n\nЭпилог.`);
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands).toHaveLength(7);
  });

  it('tolerates an uppercase ```JSON fence', () => {
    const verdict = extractAuditVerdict(`Вердикт:\n\`\`\`JSON\n${VALID_JSON}\n\`\`\``);
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands).toHaveLength(7);
  });

  it('uses the last valid fenced JSON block', () => {
    const verdict = extractAuditVerdict(
      `\`\`\`json\n{ "schema_echo": true }\n\`\`\`\n\nАнализ.\n\n\`\`\`json\n${VALID_JSON}\n\`\`\`\n\nПостскриптум после JSON.`,
    );
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands).toHaveLength(7);
  });

  it('finds a bare JSON object without a json fence', () => {
    const verdict = extractAuditVerdict(`Вердикт:\n\n${VALID_JSON}\n\nКонец.`);
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands).toHaveLength(7);
    expect(verdict?.issues).toHaveLength(2);
  });
});

// ============================================================
// Markdown fallback
// ============================================================

describe('extractAuditVerdict — markdown fallback', () => {
  it('parses human-readable band lines when no JSON exists', () => {
    const verdict = extractAuditVerdict(`## S. Итоговый вердикт

**ОСНОВА МИРА:** coherent
**СИСТЕМНАЯ ГЛУБИНА:** developing
**УВЕРЕННОСТЬ:** mixed

${CLOSING}
`);
    expect(verdict).not.toBeNull();
    expect(verdict?.source).toBe('markdown');
    expect(verdict?.bands).toEqual([
      { key: 'world_foundation', label: 'Фундамент мира', value: 'coherent' },
      { key: 'systemic_depth', label: 'Системная глубина', value: 'developing' },
    ]);
    expect(verdict?.confidence).toBe('mixed');
    expect(verdict?.issues).toEqual([]);
    expect(verdict?.recommendations).toEqual([]);
    expect(verdict?.frontier).toBeNull();
    expect(verdict?.closingStatement).toContain('Что мир уже может');
  });

  it('accepts English §26.S markers', () => {
    const verdict = extractAuditVerdict('WORLD FOUNDATION: coherent\nCONFIDENCE: low');
    expect(verdict?.source).toBe('markdown');
    expect(verdict?.bands).toEqual([
      { key: 'world_foundation', label: 'Фундамент мира', value: 'coherent' },
    ]);
    expect(verdict?.confidence).toBe('low');
  });

  it('strips punctuation and emphasis from band values', () => {
    const verdict = extractAuditVerdict('ОСНОВА МИРА: **highly generative**, по совокупности.');
    expect(verdict?.bands[0].value).toBe('highly generative');
  });

  it('recovers via markdown when the JSON is malformed', () => {
    const markdown = `ОСНОВА МИРА: coherent
УВЕРЕННОСТЬ: mixed

\`\`\`json
{ "final_verdict": { "world_foundation": "coherent"
\`\`\``;
    const verdict = extractAuditVerdict(markdown);
    expect(verdict?.source).toBe('markdown');
    expect(verdict?.bands[0].value).toBe('coherent');
  });

  it('returns null when the block carries no verdict at all', () => {
    expect(extractAuditVerdict('Просто текст без вердикта и без JSON.')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractAuditVerdict('')).toBeNull();
  });

  it('returns null when only confidence is present', () => {
    expect(extractAuditVerdict('УВЕРЕННОСТЬ: mixed')).toBeNull();
  });
});

// ============================================================
// Closing statement (§26.S)
// ============================================================

describe('extractAuditVerdict — closing statement', () => {
  it('extracts the paragraph introduced by the §26.S marker', () => {
    const verdict = extractAuditVerdict(BLOCK_5);
    expect(verdict?.closingStatement).toContain('Что мир уже может');
    expect(verdict?.closingStatement).toContain('держать экономику памяти');
    expect(verdict?.closingStatement).toContain('одна правка — сцена возврата памяти');
  });

  it('strips bold markers and blockquote marks', () => {
    const verdict = extractAuditVerdict(
      `ОСНОВА МИРА: coherent\n\n> **Что мир уже может** — держать сцену.\n`,
    );
    expect(verdict?.closingStatement).toBe('Что мир уже может — держать сцену.');
  });

  it('supports the English marker', () => {
    const verdict = extractAuditVerdict('WORLD FOUNDATION: coherent\n\nWhat the world can already do: hold the scene.');
    expect(verdict?.closingStatement).toBe('What the world can already do: hold the scene.');
  });

  it('returns null when the marker is absent', () => {
    const verdict = extractAuditVerdict('ОСНОВА МИРА: coherent');
    expect(verdict?.closingStatement).toBeNull();
  });
});

// ============================================================
// Robustness
// ============================================================

describe('extractAuditVerdict — robustness', () => {
  it('never throws on malformed JSON', () => {
    const inputs = [
      '```json\n{ broken\n```',
      '```json\n[]\n```',
      '```json\nnull\n```',
      '```json\n\n```',
      '{ "final_verdict": { "world_foundation": "coherent"',
      '```json\n{ "final_verdict": [] }\n```',
    ];
    for (const input of inputs) {
      expect(() => extractAuditVerdict(input)).not.toThrow();
    }
  });

  it('ignores JSON objects without final_verdict', () => {
    const verdict = extractAuditVerdict('```json\n{ "issues": [] }\n```');
    expect(verdict).toBeNull();
  });

  it('is pure: calling twice on the same input returns equal results', () => {
    expect(extractAuditVerdict(BLOCK_5)).toEqual(extractAuditVerdict(BLOCK_5));
  });

  it('tolerates CRLF line endings', () => {
    const verdict = extractAuditVerdict(BLOCK_5.replace(/\n/g, '\r\n'));
    expect(verdict?.source).toBe('json');
    expect(verdict?.bands).toHaveLength(7);
    expect(verdict?.closingStatement).not.toBeNull();
  });
});
