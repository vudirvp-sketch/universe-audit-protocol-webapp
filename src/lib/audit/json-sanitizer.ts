/**
 * JSON sanitizer for LLM responses.
 *
 * LLMs frequently wrap JSON in markdown code fences, prepend explanatory
 * text, or append commentary. This module extracts the actual JSON payload
 * using balanced-brace depth counting, then validates that the result is
 * parseable.
 *
 * The sanitizer handles a wide range of common LLM output issues:
 * - Markdown code fences (with whitespace variations)
 * - Python-style None/True/False literals
 * - Single-quoted strings
 * - Unquoted property names and enum values
 * - Trailing commas
 * - NaN / Infinity literals
 * - Truncated JSON (missing closing delimiters)
 *
 * References: COMPLETION_PLAN Section 2.3 — balanced brace extraction
 */

/**
 * Extract a valid JSON string from a raw LLM response.
 *
 * Steps performed:
 * 1. Strip markdown code fences (```json ... ``` or ``` ... ```) with whitespace variations
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
  // Handles edge cases: whitespace before/after fences, optional "json" tag,
  // CRLF or LF line endings, trailing spaces after closing fence, etc.
  const fencePattern = /```(?:json|JSON)?\s*\r?\n?([\s\S]*?)\r?\n?\s*```/;
  const fenceMatch = fencePattern.exec(text);
  if (fenceMatch) {
    text = fenceMatch[1];
  }

  // Step 2: Strip leading/trailing whitespace
  text = text.trim();

  // Step 3 & 4: Find balanced outermost braces using depth counting.
  const jsonCandidate = extractBalancedBraces(text);
  if (jsonCandidate === null) {
    return null;
  }

  // Step 5: Pre-parse sanitization — fix common LLM output issues
  const sanitized = sanitizeLLMJSON(jsonCandidate);

  // Step 6: Validate the extracted string is parseable JSON
  try {
    JSON.parse(sanitized);
    return sanitized;
  } catch {
    // Try the sanitized full text as a last resort
    try {
      const sanitizedFull = sanitizeLLMJSON(text);
      JSON.parse(sanitizedFull);
      return sanitizedFull;
    } catch {
      // Final fallback: try original text without sanitization
      try {
        JSON.parse(text);
        return text;
      } catch {
        return null;
      }
    }
  }
}

/**
 * Sanitize common LLM JSON output issues that prevent parsing.
 * Handles: Python-style None/True/False, trailing commas, single-quoted
 * strings, unquoted property names and enum values, NaN/Infinity literals,
 * truncated JSON with missing closing delimiters, and other quirks.
 * This runs BEFORE JSON.parse() to maximize compatibility across all LLM providers.
 */
function sanitizeLLMJSON(text: string): string {
  let result = text;

  // --- Fix single-quoted strings ---
  // Replace 'value' with "value" in JSON context, but not inside double-quoted strings
  result = result.replace(/(?<!["\w])'([^']*)'(?=\s*[,:\]}])/g, '"$1"');

  // --- Fix Python-style None → null (case-sensitive, only standalone word) ---
  result = result.replace(/\bNone\b/g, 'null');

  // --- Fix Python-style True/False → true/false (case-sensitive, only standalone words) ---
  result = result.replace(/\bTrue\b/g, 'true');
  result = result.replace(/\bFalse\b/g, 'false');

  // --- Fix NaN and Infinity → null ---
  // JSON does not support NaN or Infinity; replace them with null
  result = result.replace(/\bNaN\b/g, 'null');
  result = result.replace(/\bInfinity\b/g, 'null');
  result = result.replace(/\b-Infinity\b/g, 'null');

  // --- Fix trailing commas before closing braces/brackets ---
  // This is one of the most common LLM JSON errors
  result = result.replace(/,\s*([}\]])/g, '$1');

  // --- Fix unquoted property names ---
  // Only match property names after { , [ and start of object — this avoids
  // being too aggressive and breaking values that contain colons (e.g. URLs,
  // time strings). The previous regex /(?<!["\w])(\w+)\s*:/g was too broad.
  result = result.replace(/([{,\[]\s*)(\w+)\s*:/g, '$1"$2":');

  // --- Fix unquoted enum values ---
  // e.g. {status: PASS} → {status: "PASS"} for known enum values used in
  // the audit protocol domain
  const enumValues = [
    'PASS', 'FAIL', 'INSUFFICIENT_DATA',
    'critical', 'major', 'minor', 'cosmetic',
    'conservative', 'compromise', 'radical',
    'high', 'medium', 'low',
    'absent', 'denial', 'anger', 'bargaining', 'depression', 'acceptance',
  ];
  for (const val of enumValues) {
    // Match unquoted enum value after colon (value position), followed by
    // a comma, closing brace, or closing bracket
    const re = new RegExp(`:\\s*(${val})\\s*([,}\\]])`, 'g');
    result = result.replace(re, `: "$1"$2`);
  }

  // --- Fix missing closing braces/brackets ---
  // If the JSON is truncated (common with LLM token limits), try to add
  // missing closing delimiters by counting open vs close outside strings.
  let braceDepth = 0;
  let bracketDepth = 0;
  let inStr = false;
  let esc = false;
  for (const ch of result) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') braceDepth++;
    if (ch === '}') braceDepth--;
    if (ch === '[') bracketDepth++;
    if (ch === ']') bracketDepth--;
  }
  // Add missing closers — append in reverse order of opening
  // (If depths are negative, the JSON is fundamentally broken and adding
  // closers won't help, but we only add when depth > 0.)
  while (bracketDepth > 0) { result += ']'; bracketDepth--; }
  while (braceDepth > 0) { result += '}'; braceDepth--; }

  // --- TODO: Fix duplicate keys (best effort) ---
  // If the same key appears twice in an object, the last value should be
  // kept per JSON spec. Implementing this properly requires parsing the
  // object structure, removing earlier occurrences of duplicate keys, and
  // preserving the last. This is complex to do with regex alone and would
  // need a proper token-aware approach. For now, JSON.parse() will use the
  // last value naturally, so this is only a problem if the duplicate key
  // causes a parse error (e.g. trailing comma between duplicates).

  return result;
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
