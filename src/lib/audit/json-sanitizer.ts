/**
 * JSON sanitizer for LLM responses.
 *
 * LLMs frequently wrap JSON in markdown code fences, prepend explanatory
 * text, or append commentary. This module extracts the actual JSON payload
 * using balanced-brace depth counting, then validates that the result is
 * parseable.
 *
 * References: COMPLETION_PLAN Section 2.3 — balanced brace extraction
 */

/**
 * Extract a valid JSON string from a raw LLM response.
 *
 * Steps performed:
 * 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
 * 2. Strip leading/trailing whitespace
 * 3. Handle LLM adding explanatory text before/after JSON
 * 4. Find the outermost balanced braces using depth counting
 * 5. Validate the extracted string is parseable JSON
 * 6. Return null if no valid JSON found
 */
export function extractJSON(raw: string): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  let text = raw;

  // Step 1: Strip markdown code fences — ```json ... ``` or ``` ... ```
  // Note: no 'g' flag — we only need the first match, and .exec() with 'g'
  // mutates lastIndex which causes subtle bugs on repeated calls.
  const fencePattern = /```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/;
  const fenceMatch = fencePattern.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1];
  }

  // Step 2: Strip leading/trailing whitespace
  text = text.trim();

  // Step 3 & 4: Find balanced outermost braces using depth counting.
  // We look for the first '{' and then track brace depth to find the
  // matching '}'. This handles LLM explanatory text before/after JSON.
  const jsonCandidate = extractBalancedBraces(text);
  if (jsonCandidate === null) {
    return null;
  }

  // Step 5: Validate the extracted string is parseable JSON
  try {
    JSON.parse(jsonCandidate);
    return jsonCandidate;
  } catch {
    // The balanced-brace extraction may have found braces that don't form
    // valid JSON (e.g. prose with curly quotes). Try the full text as a
    // last resort — sometimes the LLM outputs clean JSON without any fence.
    try {
      JSON.parse(text);
      return text;
    } catch {
      return null;
    }
  }
}

/**
 * Find the outermost balanced brace pair in a string using depth counting.
 * Returns the substring between (and including) the outermost braces,
 * or null if no balanced pair is found.
 */
function extractBalancedBraces(text: string): string | null {
  // Find the first opening brace
  const firstOpen = text.indexOf('{');
  if (firstOpen === -1) {
    // Also try bracket arrays — some LLM responses are top-level arrays
    const firstBracket = text.indexOf('[');
    if (firstBracket !== -1) {
      return extractBalanced(text, firstBracket, '[', ']');
    }
    return null;
  }

  const result = extractBalanced(text, firstOpen, '{', '}');
  if (result !== null) {
    return result;
  }

  // Fallback: try top-level array if brace extraction failed
  const firstBracket = text.indexOf('[');
  if (firstBracket !== -1) {
    return extractBalanced(text, firstBracket, '[', ']');
  }

  return null;
}

/**
 * Generic balanced-delimiter extraction using depth counting.
 * Handles nested delimiters and string literals (avoids counting
 * braces inside quoted strings).
 */
function extractBalanced(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (ch === '\\') {
      if (inString) {
        escapeNext = true;
      }
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    // Only count delimiters outside of string literals
    if (!inString) {
      if (ch === openChar) {
        depth++;
      } else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          // Found the matching closing delimiter
          return text.substring(startIndex, i + 1);
        }
        // Negative depth means unbalanced — abort
        if (depth < 0) {
          return null;
        }
      }
    }
  }

  // Reached end of string without closing the outermost delimiter
  return null;
}
