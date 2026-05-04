/**
 * Chunking module for splitting long texts into LLM-manageable chunks.
 *
 * When a user uploads a book or pastes a very long text, the content may
 * exceed the LLM's context window. This module splits the text into
 * overlapping chunks that can be processed separately, then merged.
 *
 * Key design decisions:
 * - Split by paragraphs first (double newline), then by sentences if needed
 * - 10-15% overlap between adjacent chunks to preserve context
 * - Minimum chunk size of 500 characters to avoid micro-chunks
 * - Each chunk gets a `[ЧАСТЬ X из Y]` prefix for LLM awareness
 * - Model-agnostic: uses contextWindow tokens to calculate max chunk chars
 *
 * Used by:
 * - pipeline.ts for skeleton_extraction (two-pass strategy)
 * - llm-client.ts for estimateTokens() and canModelHandleInput()
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ChunkingConfig {
  /** Maximum context window in tokens for the target model */
  modelContextWindow: number;
  /** Approximate prompt overhead in tokens (system prompt + instructions) */
  promptOverhead: number;
  /** Overlap ratio between adjacent chunks (0.1 = 10%, 0.15 = 15%) */
  overlapRatio: number;
  /** Minimum chunk size in characters */
  minChunkSize: number;
}

export interface ChunkResult {
  /** The chunk text with prefix */
  text: string;
  /** Chunk index (0-based) */
  index: number;
  /** Total number of chunks */
  total: number;
  /** Character count of this chunk (without prefix) */
  charCount: number;
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate the number of tokens for a given text.
 *
 * For Russian text, the typical ratio is approximately 1 token per 3-4 characters
 * (Russian text tokenizes less efficiently than English due to Cyrillic encoding).
 * We use a conservative estimate of 1 token ≈ 3.5 characters for Russian.
 *
 * For English-heavy text (code, JSON), the ratio is closer to 1:4.
 * We use a blended estimate that works well for mixed content.
 *
 * @param text - The text to estimate tokens for
 * @param providerHint - Optional provider hint for more accurate estimation
 * @returns Estimated token count
 */
export function estimateTokens(text: string, providerHint?: string): number {
  if (!text) return 0;

  // Detect if the text is predominantly Russian
  const cyrillicCount = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) || []).length;
  const isPredominantlyRussian = cyrillicCount > latinCount;

  // Token estimation ratios (chars per token)
  // Russian: ~3.5 chars/token (less efficient tokenization)
  // English: ~4.0 chars/token (more efficient)
  // Mixed/default: ~3.7 chars/token
  let charsPerToken: number;
  if (isPredominantlyRussian) {
    charsPerToken = 3.5;
  } else if (latinCount > cyrillicCount * 3) {
    charsPerToken = 4.0;
  } else {
    charsPerToken = 3.7;
  }

  // Provider-specific adjustments
  if (providerHint === 'google') {
    // Google Gemini tends to tokenize more efficiently for Russian
    charsPerToken *= 1.1;
  } else if (providerHint === 'anthropic') {
    // Claude's tokenizer is slightly different
    charsPerToken *= 0.95;
  }

  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate the maximum number of characters that fit within a given token budget.
 */
export function estimateMaxChars(tokenBudget: number, providerHint?: string): number {
  const isRussianHint = providerHint === undefined; // default to mixed
  const charsPerToken = isRussianHint ? 3.7 : 3.7;
  return Math.floor(tokenBudget * charsPerToken);
}

// ============================================================================
// TEXT SPLITTING
// ============================================================================

/**
 * Split text into sentences. Handles Russian and English punctuation.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  // Handles: . ! ? and Russian equivalents
  const sentenceRegex = /[^.!?。！？…]+[.!?。！？…]+\s*/g;
  const matches = text.match(sentenceRegex);

  if (!matches || matches.length === 0) {
    // No sentence boundaries found — return the whole text as one "sentence"
    return text.trim() ? [text.trim()] : [];
  }

  // Check if there's remaining text after the last match
  const remainingText = text.slice(
    matches.reduce((acc, m) => acc + m.length, 0)
  ).trim();

  if (remainingText) {
    matches.push(remainingText);
  }

  return matches;
}

/**
 * Split text into paragraphs (by double newline).
 */
function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
}

/**
 * Calculate the maximum chunk size in characters based on model context window.
 *
 * Formula: (contextWindow - promptOverhead - outputReserve) * charsPerToken
 * where outputReserve is 20% of the remaining budget for the LLM's response.
 */
function calculateMaxChunkChars(config: ChunkingConfig): number {
  const availableTokens = config.modelContextWindow - config.promptOverhead;
  // Reserve 20% of available tokens for the LLM's output
  const inputTokens = Math.floor(availableTokens * 0.8);
  // Conservative chars/token ratio (3.5 for mixed Russian content)
  const maxChars = Math.floor(inputTokens * 3.5);
  return maxChars;
}

/**
 * Split a long text into overlapping chunks suitable for LLM processing.
 *
 * Strategy:
 * 1. Split by paragraphs (double newline)
 * 2. If a paragraph is too long, split by sentences
 * 3. If a sentence is too long, split by character limit (last resort)
 * 4. Add overlap between adjacent chunks (10-15% by default)
 * 5. Add [ЧАСТЬ X из Y] prefix to each chunk
 *
 * @param text - The full text to split
 * @param config - Chunking configuration
 * @returns Array of chunk results with prefixes
 */
export function splitIntoChunks(text: string, config: ChunkingConfig): ChunkResult[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const maxChunkChars = calculateMaxChunkChars(config);
  const overlapChars = Math.floor(maxChunkChars * config.overlapRatio);

  // If the text fits within one chunk, no splitting needed
  if (text.length <= maxChunkChars) {
    return [{
      text: text,
      index: 0,
      total: 1,
      charCount: text.length,
    }];
  }

  // Step 1: Split into paragraphs
  const paragraphs = splitIntoParagraphs(text);

  // Step 2: Group paragraphs into chunks respecting maxChunkChars
  const rawChunks: string[] = [];
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the limit
    if (currentChunk.length + paragraph.length + 2 > maxChunkChars && currentChunk.length > 0) {
      // Save the current chunk and start a new one
      rawChunks.push(currentChunk.trim());
      currentChunk = '';
    }

    // If the paragraph itself exceeds the chunk limit, split it by sentences
    if (paragraph.length > maxChunkChars) {
      // First save any accumulated content
      if (currentChunk.trim().length > 0) {
        rawChunks.push(currentChunk.trim());
        currentChunk = '';
      }

      // Split the long paragraph by sentences
      const sentences = splitIntoSentences(paragraph);
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length > maxChunkChars && sentenceChunk.length > 0) {
          rawChunks.push(sentenceChunk.trim());
          sentenceChunk = '';
        }

        // If even a single sentence is too long, split it by character limit
        if (sentence.length > maxChunkChars) {
          if (sentenceChunk.trim().length > 0) {
            rawChunks.push(sentenceChunk.trim());
            sentenceChunk = '';
          }
          // Split by character limit, trying to break at word boundaries
          let remaining = sentence;
          while (remaining.length > maxChunkChars) {
            let breakPoint = remaining.lastIndexOf(' ', maxChunkChars);
            if (breakPoint < maxChunkChars * 0.5) {
              breakPoint = maxChunkChars; // No good word boundary — hard break
            }
            rawChunks.push(remaining.slice(0, breakPoint).trim());
            remaining = remaining.slice(breakPoint).trim();
          }
          if (remaining.trim()) {
            sentenceChunk = remaining;
          }
        } else {
          sentenceChunk += sentence;
        }
      }

      if (sentenceChunk.trim().length >= config.minChunkSize || rawChunks.length === 0) {
        currentChunk = sentenceChunk;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    rawChunks.push(currentChunk.trim());
  }

  // Step 3: Add overlap between adjacent chunks
  const overlappedChunks: string[] = [];
  for (let i = 0; i < rawChunks.length; i++) {
    let chunk = rawChunks[i];

    // Prepend overlap from the previous chunk
    if (i > 0 && overlapChars > 0) {
      const prevChunk = rawChunks[i - 1];
      const overlapText = prevChunk.slice(-overlapChars);
      // Find the first sentence boundary in the overlap to start cleanly
      const sentenceStart = overlapText.search(/[.!?。！？…]\s+/);
      const cleanOverlap = sentenceStart >= 0 ? overlapText.slice(sentenceStart + 2) : overlapText;
      if (cleanOverlap.trim()) {
        chunk = cleanOverlap.trim() + '\n\n' + chunk;
      }
    }

    overlappedChunks.push(chunk);
  }

  // Step 4: Add [ЧАСТЬ X из Y] prefix and build results
  const totalChunks = overlappedChunks.length;
  const results: ChunkResult[] = overlappedChunks.map((chunk, index) => {
    const prefix = totalChunks > 1 ? `[ЧАСТЬ ${index + 1} из ${totalChunks}]\n\n` : '';
    return {
      text: prefix + chunk,
      index,
      total: totalChunks,
      charCount: chunk.length,
    };
  });

  return results;
}

/**
 * Check if a model can handle the given input text within its context window.
 *
 * @param modelContextWindow - The model's context window in tokens
 * @param inputChars - The number of characters in the input text
 * @param promptOverhead - The estimated prompt overhead in tokens
 * @param providerHint - Optional provider hint for token estimation
 * @returns true if the text likely fits, false if chunking is needed
 */
export function canModelHandleInput(
  modelContextWindow: number,
  inputChars: number,
  promptOverhead: number,
  providerHint?: string,
): boolean {
  const inputTokens = estimateTokens(' '.repeat(inputChars), providerHint);
  const availableTokens = modelContextWindow - promptOverhead;
  // Reserve 20% for output
  const maxInputTokens = Math.floor(availableTokens * 0.8);
  return inputTokens <= maxInputTokens;
}

/**
 * Determine if chunking is needed for a given text and model.
 * Returns the recommended number of chunks (1 = no chunking needed).
 */
export function getRecommendedChunkCount(
  inputChars: number,
  modelContextWindow: number,
  promptOverhead: number,
): number {
  if (canModelHandleInput(modelContextWindow, inputChars, promptOverhead)) {
    return 1;
  }

  const config: ChunkingConfig = {
    modelContextWindow,
    promptOverhead,
    overlapRatio: 0.12,
    minChunkSize: 500,
  };

  const maxChunkChars = calculateMaxChunkChars(config);
  // Rough estimate: how many chunks we'll need
  return Math.ceil(inputChars / (maxChunkChars * 0.85)); // 85% because of overlap overhead
}

/**
 * Default chunking config for unknown models.
 */
export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  modelContextWindow: 128000,
  promptOverhead: 4000,
  overlapRatio: 0.12,
  minChunkSize: 500,
};
