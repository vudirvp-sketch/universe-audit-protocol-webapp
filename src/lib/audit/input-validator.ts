/**
 * T0.4 — Input Validation
 * Universe Audit Protocol v10.0
 * 
 * Implements Step 0 input validation
 * Validates all required fields before audit begins
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: RegExp;
  customValidator?: (value: unknown) => boolean;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  normalizedInput?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

export interface InputSchema {
  concept: string;
  worldbuilding?: Record<string, unknown>;
  characters?: unknown[];
  themes?: string[];
  tone?: string;
  mediaType?: string;
  targetLength?: string;
  existingContent?: string;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

const INPUT_VALIDATION_RULES: ValidationRule[] = [
  {
    field: 'concept',
    required: true,
    type: 'string',
    minLength: 50,
    maxLength: 10000,
    errorMessage: 'Concept must be between 50 and 10000 characters'
  },
  {
    field: 'mediaType',
    required: false,
    type: 'string',
    errorMessage: 'Media type must be a string'
  },
  {
    field: 'targetLength',
    required: false,
    type: 'string',
    errorMessage: 'Target length must be a string'
  },
  {
    field: 'tone',
    required: false,
    type: 'string',
    errorMessage: 'Tone must be a string'
  },
  {
    field: 'worldbuilding',
    required: false,
    type: 'object',
    errorMessage: 'Worldbuilding must be an object'
  },
  {
    field: 'characters',
    required: false,
    type: 'array',
    errorMessage: 'Characters must be an array'
  },
  {
    field: 'themes',
    required: false,
    type: 'array',
    errorMessage: 'Themes must be an array'
  }
];

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validates input against all rules
 * Returns detailed validation result
 */
export function validateInput(
  input: Record<string, unknown>,
  rules: ValidationRule[] = INPUT_VALIDATION_RULES
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const normalizedInput: Record<string, unknown> = {};

  for (const rule of rules) {
    const value = input[rule.field];
    const result = validateField(value, rule);

    if (!result.valid) {
      if (rule.required) {
        errors.push({
          field: rule.field,
          message: result.message || rule.errorMessage || 'Validation failed',
          code: `REQUIRED_${rule.field.toUpperCase()}`,
          severity: 'error'
        });
      } else if (value !== undefined) {
        warnings.push({
          field: rule.field,
          message: result.message || rule.errorMessage || 'Validation warning',
          code: `OPTIONAL_${rule.field.toUpperCase()}`,
          severity: 'warning'
        });
      }
    } else if (value !== undefined) {
      normalizedInput[rule.field] = result.normalizedValue;
    }
  }

  // Check for extra fields
  const knownFields = rules.map(r => r.field);
  for (const key of Object.keys(input)) {
    if (!knownFields.includes(key)) {
      warnings.push({
        field: key,
        message: `Unknown field '${key}' will be ignored`,
        code: 'UNKNOWN_FIELD',
        severity: 'warning'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    normalizedInput
  };
}

/**
 * Validates a single field against a rule
 */
function validateField(
  value: unknown,
  rule: ValidationRule
): { valid: boolean; message?: string; normalizedValue?: unknown } {
  
  // Check required
  if (rule.required && (value === undefined || value === null)) {
    return {
      valid: false,
      message: `Field '${rule.field}' is required`
    };
  }

  // Skip if optional and not provided
  if (!rule.required && (value === undefined || value === null)) {
    return { valid: true };
  }

  // Type check
  const typeValid = checkType(value, rule.type);
  if (!typeValid) {
    return {
      valid: false,
      message: `Field '${rule.field}' must be of type ${rule.type}`
    };
  }

  // String validations
  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return {
        valid: false,
        message: `Field '${rule.field}' must be at least ${rule.minLength} characters`
      };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return {
        valid: false,
        message: `Field '${rule.field}' must be at most ${rule.maxLength} characters`
      };
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return {
        valid: false,
        message: `Field '${rule.field}' does not match required pattern`
      };
    }
    return { valid: true, normalizedValue: value.trim() };
  }

  // Number validations
  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.minValue !== undefined && value < rule.minValue) {
      return {
        valid: false,
        message: `Field '${rule.field}' must be at least ${rule.minValue}`
      };
    }
    if (rule.maxValue !== undefined && value > rule.maxValue) {
      return {
        valid: false,
        message: `Field '${rule.field}' must be at most ${rule.maxValue}`
      };
    }
    return { valid: true, normalizedValue: value };
  }

  // Array validations
  if (rule.type === 'array' && Array.isArray(value)) {
    return { valid: true, normalizedValue: value };
  }

  // Object validations
  if (rule.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    return { valid: true, normalizedValue: value };
  }

  // Boolean validations
  if (rule.type === 'boolean' && typeof value === 'boolean') {
    return { valid: true, normalizedValue: value };
  }

  // Custom validator
  if (rule.customValidator && !rule.customValidator(value)) {
    return {
      valid: false,
      message: `Field '${rule.field}' failed custom validation`
    };
  }

  return { valid: true, normalizedValue: value };
}

/**
 * Checks if a value matches the expected type
 */
function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value as number);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
}

// ============================================================================
// CONCEPT VALIDATION
// ============================================================================

/**
 * Validates concept content specifically
 * Checks for minimum viable content for audit
 */
export function validateConcept(concept: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Minimum length
  if (concept.length < 50) {
    errors.push({
      field: 'concept',
      message: 'Concept is too short. Provide at least 50 characters for meaningful analysis.',
      code: 'CONCEPT_TOO_SHORT',
      severity: 'error'
    });
  }

  // Check for narrative elements
  const hasCharacter = /\b(protagonist|hero|character|person|he|she|they|I)\b/i.test(concept);
  const hasConflict = /\b(conflict|struggle|battle|fight|opposition|against)\b/i.test(concept);
  const hasSetting = /\b(world|setting|place|land|kingdom|city|planet)\b/i.test(concept);
  const hasPlot = /\b(plot|story|journey|quest|adventure|mission)\b/i.test(concept);

  if (!hasCharacter) {
    warnings.push({
      field: 'concept',
      message: 'No clear character reference detected. Consider adding protagonist information.',
      code: 'NO_CHARACTER',
      severity: 'warning'
    });
  }

  if (!hasConflict) {
    warnings.push({
      field: 'concept',
      message: 'No clear conflict detected. Consider adding the central struggle.',
      code: 'NO_CONFLICT',
      severity: 'warning'
    });
  }

  if (!hasSetting) {
    warnings.push({
      field: 'concept',
      message: 'No clear setting detected. Consider adding world/setting information.',
      code: 'NO_SETTING',
      severity: 'warning'
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// QUICK VALIDATION
// ============================================================================

/**
 * Quick validation for basic input check
 * Returns simple boolean with minimal overhead
 */
export function quickValidate(input: Record<string, unknown>): boolean {
  return typeof input.concept === 'string' && input.concept.length >= 50;
}

// ============================================================================
// STEP 0 ENTRY POINT
// ============================================================================

/**
 * Performs Step 0 validation as entry point for audit
 * Combines all validation checks
 */
export function performStep0Validation(input: Record<string, unknown>): ValidationResult {
  // Basic input validation
  const basicResult = validateInput(input);
  
  // Concept-specific validation
  let conceptResult: ValidationResult | null = null;
  if (typeof input.concept === 'string') {
    conceptResult = validateConcept(input.concept);
  }

  // Combine results
  const allErrors = [...basicResult.errors];
  const allWarnings = [...basicResult.warnings];
  
  if (conceptResult) {
    allErrors.push(...conceptResult.errors);
    allWarnings.push(...conceptResult.warnings);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    normalizedInput: basicResult.normalizedInput
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const REQUIRED_FIELDS = INPUT_VALIDATION_RULES
  .filter(r => r.required)
  .map(r => r.field);

export const OPTIONAL_FIELDS = INPUT_VALIDATION_RULES
  .filter(r => !r.required)
  .map(r => r.field);
