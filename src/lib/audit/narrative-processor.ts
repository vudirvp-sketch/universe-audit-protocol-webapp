/**
 * Narrative Processor — Smart Compression for Gate Evaluation Steps (L1–L4)
 *
 * The core insight: short narratives pass through as-is; long narratives get a
 * deterministic "digest" that preserves audit-relevant content while fitting
 * within context windows.
 *
 * Why this is NOT a hack:
 *  1. Opening preserved — establishes world rules and narrative premises
 *  2. Skeleton-guided extraction — uses already-extracted structural keywords
 *     to locate evidence-bearing passages
 *  3. Closing preserved — where consequences and resolution manifest
 *  4. Deterministic — same input always produces same output
 *  5. Gate steps already have the skeleton as structural context, so they
 *     don't need every word of the narrative
 *
 * Digest layout (target ≤ 12K chars):
 *  ┌──────────────────────────┐
 *  │ Opening   (~3 000 chars) │  ← sets the world
 *  │ [...]                    │
 *  │ Keywords  (~6 000 chars) │  ← skeleton-guided evidence passages
 *  │ [...]                    │
 *  │ Closing   (~3 000 chars) │  ← consequences & resolution
 *  └──────────────────────────┘
 */

/**
 * Legacy skeleton interface for extractSkeletonKeywords.
 * Kept as a local type to avoid breaking changes with narrative-processor-v2.ts
 * which wraps SkeletonV2 into this format before calling extractSkeletonKeywords.
 */
interface LegacySkeletonElement {
  id: string;
  name: string;
  value: string | null;
  status: string;
  extracted?: string;
}

interface LegacySkeleton {
  elements: LegacySkeletonElement[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Narratives shorter than this are passed through as-is. */
const DIGEST_THRESHOLD_CHARS = 15_000;

/** Approximate character budget for the opening section. */
const OPENING_BUDGET_CHARS = 3_000;

/** Approximate character budget for the keyword-guided middle section. */
const MIDDLE_BUDGET_CHARS = 6_000;

/** Approximate character budget for the closing section. */
const CLOSING_BUDGET_CHARS = 3_000;

/** Maximum total digest size. If the assembled digest exceeds this, the
 *  caller should fall back to the original — but we also enforce this
 *  internally as a hard cap. */
const MAX_DIGEST_CHARS = 12_000;

/** Omission marker inserted between preserved sections. */
const OMISSION_MARKER = '\n[...]\n';

/** Minimum word length (in characters) for a word to be considered a
 *  significant keyword. Russian content is the primary target, so this
 *  filters out short prepositions and particles. */
const MIN_KEYWORD_LENGTH = 4;

/** Rough token-to-char ratio for Russian text (1 token ≈ 4 chars). */
const CHARS_PER_TOKEN = 4;

/**
 * Safety margin: we never let the digest exceed this fraction of the
 * model's context window, to leave room for the system prompt, skeleton,
 * checklist, and the model's response. Even large-context models get
 * capped at a reasonable digest size to avoid unnecessary costs.
 */
const MAX_CONTEXT_FRACTION = 0.4;

/**
 * Reserve tokens for non-narrative parts of the prompt (system message,
 * skeleton JSON, checklist, instructions, JSON format enforcement).
 * This is a conservative estimate of ~3000 tokens.
 */
const PROMPT_OVERHEAD_TOKENS = 3_000;

/**
 * Reserve tokens for the model's response output.
 * Gate evaluations typically need 2000-4000 tokens of output.
 */
const RESPONSE_RESERVE_TOKENS = 4_000;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Estimate the token count for a piece of text.
 *
 * Uses the rough heuristic of 1 token ≈ 4 characters, which is a reasonable
 * approximation for Russian-language content processed by modern LLMs.
 * For mixed-language content this is still a workable upper bound.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Determine whether a narrative text should be compressed into a digest.
 *
 * Returns `true` when the text is at least {@link DIGEST_THRESHOLD_CHARS}
 * characters long.
 */
export function shouldUseDigest(text: string): boolean {
  return text.length >= DIGEST_THRESHOLD_CHARS;
}

/**
 * Compute the maximum character budget for the narrative digest given a
 * model's context window size (in tokens).
 *
 * This ensures the digest never exceeds what the model can actually process,
 * leaving room for the system prompt, skeleton, checklist, and response.
 *
 * Formula:
 *   available_tokens = contextWindow - PROMPT_OVERHEAD - RESPONSE_RESERVE
 *   max_digest_chars = min(available_tokens × CHARS_PER_TOKEN, MAX_DIGEST_CHARS)
 *
 * For a model with contextWindow = 32K tokens:
 *   available = 32000 - 3000 - 4000 = 25000 tokens → 100K chars (capped to 12K)
 * For a model with contextWindow = 8K tokens:
 *   available = 8192 - 3000 - 4000 = 1192 tokens → 4768 chars (significant reduction!)
 *
 * @param contextWindowTokens - The model's total context window in tokens
 * @returns Maximum character count for the narrative digest
 */
export function computeMaxDigestChars(contextWindowTokens: number): number {
  const availableTokens = Math.max(
    0,
    contextWindowTokens - PROMPT_OVERHEAD_TOKENS - RESPONSE_RESERVE_TOKENS
  );
  const maxFromContext = Math.floor(availableTokens * MAX_CONTEXT_FRACTION * CHARS_PER_TOKEN);
  // Always cap at MAX_DIGEST_CHARS — even huge context windows don't need more
  return Math.min(maxFromContext, MAX_DIGEST_CHARS);
}

/**
 * Determine whether a narrative needs compression based on the model's
 * context window. Unlike shouldUseDigest (which uses a fixed threshold),
 * this accounts for models with very small context windows where even
 * shorter texts might not fit.
 *
 * @param text - The narrative text
 * @param contextWindowTokens - The model's total context window in tokens
 * @returns true if the text should be compressed for this model
 */
export function shouldUseDigestForModel(text: string, contextWindowTokens: number): boolean {
  if (shouldUseDigest(text)) return true;
  // Even for shorter texts, check if they fit in the model's context
  const maxDigestChars = computeMaxDigestChars(contextWindowTokens);
  return text.length > maxDigestChars;
}

// ---------------------------------------------------------------------------
// Skeleton keyword extraction
// ---------------------------------------------------------------------------

/**
 * Extract significant keywords from a Skeleton object.
 *
 * For each element that has a non-null `value` (and optionally `extracted`),
 * split the text into words and keep those that are at least
 * {@link MIN_KEYWORD_LENGTH} characters long. The result is a deduplicated
 * array of lowercase keywords suitable for passage scoring.
 *
 * @param skeleton - The parsed Skeleton (from the skeleton extraction step)
 * @returns An array of unique lowercase keywords
 */
export function extractSkeletonKeywords(skeleton: LegacySkeleton): string[] {
  const keywordSet = new Set<string>();

  for (const element of skeleton.elements) {
    // Collect text from both `value` and `extracted` fields
    const textSources: string[] = [];
    if (element.value !== null) {
      textSources.push(element.value);
    }
    if (element.extracted) {
      textSources.push(element.extracted);
    }
    // Also include the element name itself — it often carries structural
    // significance (e.g. "thematic_law", "root_trauma")
    if (element.name) {
      textSources.push(element.name);
    }

    for (const src of textSources) {
      // Split on non-letter characters; keeps Cyrillic and Latin letters
      const words = src.split(/[^a-zA-Zа-яА-ЯёЁ]+/);
      for (const word of words) {
        const lowered = word.toLowerCase();
        if (lowered.length >= MIN_KEYWORD_LENGTH) {
          keywordSet.add(lowered);
        }
      }
    }
  }

  return Array.from(keywordSet);
}

// ---------------------------------------------------------------------------
// Paragraph splitting
// ---------------------------------------------------------------------------

/**
 * Split narrative text into paragraphs.
 *
 * A paragraph is a contiguous block of non-empty lines. Blank lines
 * (including lines with only whitespace) serve as delimiters.
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------
// Keyword scoring
// ---------------------------------------------------------------------------

/**
 * Score a paragraph by counting how many skeleton keywords appear in it.
 *
 * Each unique keyword that appears at least once in the paragraph contributes
 * 1 point. Repeated occurrences of the same keyword are NOT counted
 * multiple times — we care about topical relevance, not keyword stuffing.
 */
function scoreParagraph(paragraph: string, keywords: string[]): number {
  const lower = paragraph.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score++;
    }
  }
  return score;
}

// ---------------------------------------------------------------------------
// Section extraction helpers
// ---------------------------------------------------------------------------

/**
 * Greedily take paragraphs from the start until the accumulated character
 * count reaches `budget`. Returns the selected paragraphs and the index of
 * the first unselected paragraph.
 */
function takeOpeningParagraphs(
  paragraphs: string[],
  budget: number,
): { taken: string[]; nextIndex: number } {
  const taken: string[] = [];
  let charCount = 0;
  let i = 0;

  while (i < paragraphs.length && charCount < budget) {
    const p = paragraphs[i];
    // Include at least one paragraph even if it exceeds the budget
    if (taken.length > 0 && charCount + p.length > budget) {
      break;
    }
    taken.push(p);
    charCount += p.length + 1; // +1 for the newline that would join them
    i++;
  }

  return { taken, nextIndex: i };
}

/**
 * Greedily take paragraphs from the end until the accumulated character
 * count reaches `budget`. Returns the selected paragraphs (in original
 * order) and the index of the last paragraph that was NOT taken.
 */
function takeClosingParagraphs(
  paragraphs: string[],
  budget: number,
): { taken: string[]; prevIndex: number } {
  const taken: string[] = [];
  let charCount = 0;
  let i = paragraphs.length - 1;

  while (i >= 0 && charCount < budget) {
    const p = paragraphs[i];
    if (taken.length > 0 && charCount + p.length > budget) {
      break;
    }
    taken.unshift(p); // prepend to preserve original order
    charCount += p.length + 1;
    i--;
  }

  return { taken, prevIndex: i };
}

// ---------------------------------------------------------------------------
// Main digest computation
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic digest of a long narrative, preserving
 * audit-relevant content.
 *
 * Algorithm:
 *  1. Split text into paragraphs.
 *  2. Keep the opening N paragraphs (≈ {@link OPENING_BUDGET_CHARS}).
 *  3. Score each remaining middle paragraph by skeleton keyword overlap.
 *  4. Keep the top-scoring middle paragraphs (≈ {@link MIDDLE_BUDGET_CHARS}).
 *  5. Keep the closing N paragraphs (≈ {@link CLOSING_BUDGET_CHARS}).
 *  6. Join the three sections with "[...]" omission markers.
 *  7. If the result is longer than the original, return the original.
 *
 * The function is deterministic: the same inputs always produce the same
 * output, which is essential for audit reproducibility.
 *
 * @param text             - The full narrative text
 * @param skeletonKeywords - Keywords extracted from the skeleton via
 *                           {@link extractSkeletonKeywords}
 * @returns The compressed digest, or the original text if compression
 *          would not reduce length
 */
export function computeNarrativeDigest(
  text: string,
  skeletonKeywords: string[],
): string {
  // Fast path: if the text is short enough, no compression needed
  if (text.length < DIGEST_THRESHOLD_CHARS) {
    return text;
  }

  // If there are no keywords at all, we still preserve opening + closing
  const keywords = skeletonKeywords.length > 0 ? skeletonKeywords : [];

  const paragraphs = splitIntoParagraphs(text);

  // Edge case: very few paragraphs — just return as-is
  if (paragraphs.length <= 3) {
    return text;
  }

  // --- Opening section ---
  const { taken: openingParas, nextIndex: afterOpening } =
    takeOpeningParagraphs(paragraphs, OPENING_BUDGET_CHARS);

  // --- Closing section ---
  const { taken: closingParas, prevIndex: beforeClosing } =
    takeClosingParagraphs(paragraphs, CLOSING_BUDGET_CHARS);

  // --- Middle section: keyword-guided extraction ---
  // The "middle" is the range of paragraphs not already claimed by opening
  // or closing sections.
  const middleStart = afterOpening;
  const middleEnd = beforeClosing;

  const middleParagraphs: { paragraph: string; score: number; index: number }[] = [];

  if (middleStart <= middleEnd) {
    for (let i = middleStart; i <= middleEnd; i++) {
      const p = paragraphs[i];
      const s = scoreParagraph(p, keywords);
      middleParagraphs.push({ paragraph: p, score: s, index: i });
    }
  }

  // Sort by score descending; break ties by original index (earlier = higher
  // priority, because narrative order carries meaning).
  middleParagraphs.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  // Greedily take the highest-scoring paragraphs until we hit the budget.
  // Then re-sort by original index so the output reads in narrative order.
  const selectedMiddle: string[] = [];
  let middleCharCount = 0;

  for (const mp of middleParagraphs) {
    if (middleCharCount + mp.paragraph.length + 1 > MIDDLE_BUDGET_CHARS) {
      break;
    }
    selectedMiddle.push(mp.paragraph);
    middleCharCount += mp.paragraph.length + 1;
  }

  // Restore narrative order for readability
  selectedMiddle.sort((a, b) => {
    const idxA = paragraphs.indexOf(a);
    const idxB = paragraphs.indexOf(b);
    return idxA - idxB;
  });

  // --- Assemble digest ---
  const sections: string[] = [];

  if (openingParas.length > 0) {
    sections.push(openingParas.join('\n\n'));
  }

  if (selectedMiddle.length > 0) {
    sections.push(selectedMiddle.join('\n\n'));
  }

  if (closingParas.length > 0) {
    sections.push(closingParas.join('\n\n'));
  }

  let digest = sections.join(OMISSION_MARKER);

  // Hard cap: if the digest somehow exceeds the max, truncate the middle.
  // This is extremely unlikely given the budgets, but we enforce it for safety.
  if (digest.length > MAX_DIGEST_CHARS) {
    const opening = openingParas.join('\n\n');
    const closing = closingParas.join('\n\n');
    const headroom = MAX_DIGEST_CHARS - opening.length - closing.length - 2 * OMISSION_MARKER.length;
    if (headroom > 0 && selectedMiddle.length > 0) {
      // Trim middle paragraphs to fit
      let trimmedMiddle = '';
      for (const mp of selectedMiddle) {
        if (trimmedMiddle.length + mp.length + 2 > headroom) break;
        trimmedMiddle += (trimmedMiddle ? '\n\n' : '') + mp;
      }
      digest = opening + OMISSION_MARKER + trimmedMiddle + OMISSION_MARKER + closing;
    } else {
      // Only opening + closing
      digest = opening + OMISSION_MARKER + closing;
    }
  }

  // Final safety: if digest is not shorter, return original
  if (digest.length >= text.length) {
    return text;
  }

  return digest;
}
