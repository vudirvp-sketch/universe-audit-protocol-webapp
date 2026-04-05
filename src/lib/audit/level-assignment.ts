/**
 * T1.3 — Single Level-Assignment Function
 * Universe Audit Protocol v10.0
 * 
 * Implements the SINGLE source of truth for level assignment
 * Items tagged L1/L2 → assign to L1 exclusively
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AuditLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface LevelAssignmentResult {
  level: AuditLevel;
  confidence: number; // 0-1
  reasons: string[];
  blocked: boolean;
  blockReason?: string;
}

export interface LevelAssignmentConfig {
  l1Keywords: Set<string>;
  l2Keywords: Set<string>;
  l3Keywords: Set<string>;
  l0Indicators: Set<string>;
}

export interface PartitionResult {
  L0: string[];
  L1: string[];
  L2: string[];
  L3: string[];
}

// ============================================================================
// KEYWORD SETS
// ============================================================================

const L1_KEYWORDS = new Set([
  // Core L1 elements
  'thematic_law', 'theme', 'thematic',
  'root_trauma', 'trauma', 'origin',
  'hamartia', 'fatal_flaw', 'tragic_flaw',
  'core', 'foundation', 'fundamental',
  'skeleton', 'structure', 'backbone',
  'essence', 'soul', 'heart',
  // Priority indicators
  'primary', 'essential', 'critical',
  'non-negotiable', 'required', 'mandatory',
  // Structural elements
  'law', 'rule', 'principle',
  'deprivation', 'wound'
]);

const L2_KEYWORDS = new Set([
  // L2 elements
  'character_arc', 'arc', 'development',
  'worldbuilding', 'world_logic', 'consistency',
  'dialogue', 'conversation', 'speech',
  'comparative', 'reference', 'benchmark',
  'new_element', 'addition', 'introduction',
  'cult_potential', 'potential', 'promise',
  // Secondary indicators
  'secondary', 'supporting', 'auxiliary',
  'enhancement', 'refinement', 'improvement'
]);

const L3_KEYWORDS = new Set([
  // L3 elements
  'grief', 'denial', 'anger', 'bargaining', 'depression', 'acceptance',
  'final_synthesis', 'synthesis', 'integration',
  'transformation', 'transcendence',
  'resolution', 'culmination', 'peak',
  // L3-specific
  'world_level', 'society_level', 'character_level', 'scene_level',
  'grief_architecture', 'emotional_structure'
]);

const L0_INDICATORS = new Set([
  'input', 'validation', 'basic',
  'preliminary', 'setup', 'initial',
  'prerequisite', 'entry', 'gate_0'
]);

// ============================================================================
// MAIN LEVEL ASSIGNMENT FUNCTION
// ============================================================================

/**
 * SINGLE SOURCE OF TRUTH for level assignment
 * 
 * NON-NEGOTIABLE RULE:
 * Items tagged L1/L2 → assign to L1 exclusively
 * 
 * This function must be used for ALL level determinations
 */
export function assignLevel(
  item: {
    tags?: string[];
    keywords?: string[];
    description?: string;
    explicitLevel?: AuditLevel;
  }
): LevelAssignmentResult {
  const reasons: string[] = [];
  let blocked = false;
  let blockReason: string | undefined;

  // Check explicit level first
  if (item.explicitLevel) {
    // NON-NEGOTIABLE: L1/L2 tags → L1
    if (item.explicitLevel === 'L2' && hasL1Indicators(item)) {
      return {
        level: 'L1',
        confidence: 1.0,
        reasons: ['Explicit L2 overridden by L1 indicators (NON-NEGOTIABLE RULE)'],
        blocked: false
      };
    }
    
    return {
      level: item.explicitLevel,
      confidence: 1.0,
      reasons: [`Explicit level assignment: ${item.explicitLevel}`],
      blocked: false
    };
  }

  // Collect all text for analysis
  const allText = [
    ...(item.tags || []),
    ...(item.keywords || []),
    item.description || ''
  ].join(' ').toLowerCase();

  // Count keyword matches
  const l1Matches = countKeywordMatches(allText, L1_KEYWORDS);
  const l2Matches = countKeywordMatches(allText, L2_KEYWORDS);
  const l3Matches = countKeywordMatches(allText, L3_KEYWORDS);
  const l0Matches = countKeywordMatches(allText, L0_INDICATORS);

  // Determine level based on matches
  // NON-NEGOTIABLE: L1 indicators take precedence
  if (l1Matches > 0) {
    // Check if also has L2 indicators
    if (l2Matches > 0) {
      reasons.push('L1/L2 combination detected → assigned to L1 (NON-NEGOTIABLE RULE)');
      return {
        level: 'L1',
        confidence: 0.95,
        reasons,
        blocked: false
      };
    }
    
    reasons.push(`L1 indicators found: ${l1Matches} matches`);
    return {
      level: 'L1',
      confidence: Math.min(0.9, 0.5 + l1Matches * 0.1),
      reasons,
      blocked: false
    };
  }

  // L3 check
  if (l3Matches > 0) {
    reasons.push(`L3 indicators found: ${l3Matches} matches`);
    
    // L3 requires L1 and L2 to be complete
    if (l1Matches === 0) {
      blocked = true;
      blockReason = 'L3 requires L1 elements to be complete first';
    }
    
    return {
      level: 'L3',
      confidence: Math.min(0.9, 0.5 + l3Matches * 0.1),
      reasons,
      blocked,
      blockReason
    };
  }

  // L2 check
  if (l2Matches > 0) {
    reasons.push(`L2 indicators found: ${l2Matches} matches`);
    return {
      level: 'L2',
      confidence: Math.min(0.9, 0.5 + l2Matches * 0.1),
      reasons,
      blocked: false
    };
  }

  // L0 check (default)
  if (l0Matches > 0) {
    reasons.push(`L0 indicators found: ${l0Matches} matches`);
    return {
      level: 'L0',
      confidence: Math.min(0.8, 0.5 + l0Matches * 0.1),
      reasons,
      blocked: false
    };
  }

  // Default to L0
  reasons.push('No specific level indicators found - defaulting to L0');
  return {
    level: 'L0',
    confidence: 0.5,
    reasons,
    blocked: false
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if item has L1 indicators
 */
function hasL1Indicators(item: {
  tags?: string[];
  keywords?: string[];
  description?: string;
}): boolean {
  const allText = [
    ...(item.tags || []),
    ...(item.keywords || []),
    item.description || ''
  ].join(' ').toLowerCase();

  return countKeywordMatches(allText, L1_KEYWORDS) > 0;
}

/**
 * Counts keyword matches in text
 */
function countKeywordMatches(text: string, keywords: Set<string>): number {
  let count = 0;
  const words = text.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    // Check exact match
    if (keywords.has(word)) {
      count++;
      continue;
    }
    
    // Check partial match (for compound words)
    for (const keyword of keywords) {
      if (word.includes(keyword) || keyword.includes(word)) {
        count++;
        break;
      }
    }
  }
  
  return count;
}

// ============================================================================
// PARTITION FUNCTIONS
// ============================================================================

/**
 * Partitions items into level buckets
 */
export function partitionByLevel(
  items: Array<{
    id: string;
    tags?: string[];
    keywords?: string[];
    description?: string;
    explicitLevel?: AuditLevel;
  }>
): PartitionResult {
  const result: PartitionResult = {
    L0: [],
    L1: [],
    L2: [],
    L3: []
  };

  for (const item of items) {
    const assignment = assignLevel(item);
    result[assignment.level].push(item.id);
  }

  return result;
}

/**
 * Validates level assignment order
 * L1 must be complete before L2, L2 before L3
 */
export function validateLevelOrder(
  completedLevels: AuditLevel[]
): { valid: boolean; message?: string } {
  const levelOrder: AuditLevel[] = ['L0', 'L1', 'L2', 'L3'];
  
  let lastIndex = -1;
  for (const level of completedLevels) {
    const index = levelOrder.indexOf(level);
    if (index === -1) {
      return { valid: false, message: `Invalid level: ${level}` };
    }
    if (index > lastIndex + 1) {
      return {
        valid: false,
        message: `Cannot skip levels. Complete ${levelOrder[lastIndex + 1]} before ${level}`
      };
    }
    lastIndex = Math.max(lastIndex, index);
  }

  return { valid: true };
}

// ============================================================================
// LEVEL REQUIREMENTS
// ============================================================================

export interface LevelRequirements {
  level: AuditLevel;
  minElements: number;
  requiredElements: string[];
  gates: string[];
  description: string;
}

export const LEVEL_REQUIREMENTS: Record<AuditLevel, LevelRequirements> = {
  L0: {
    level: 'L0',
    minElements: 1,
    requiredElements: ['valid_input'],
    gates: ['GATE-0'],
    description: 'Input validation and skeleton extraction'
  },
  L1: {
    level: 'L1',
    minElements: 3,
    requiredElements: ['thematic_law', 'root_trauma', 'hamartia'],
    gates: ['GATE-1', 'GATE-2', 'GATE-3', 'GATE-4'],
    description: 'Core structural elements'
  },
  L2: {
    level: 'L2',
    minElements: 3,
    requiredElements: ['character_arcs', 'world_consistency', 'dialogue_dynamics'],
    gates: ['GATE-5'],
    description: 'Secondary validation elements'
  },
  L3: {
    level: 'L3',
    minElements: 1,
    requiredElements: ['grief_architecture'],
    gates: ['GATE-6'],
    description: 'Final synthesis and emotional architecture'
  }
};

/**
 * Checks if a level's requirements are met
 */
export function checkLevelRequirements(
  level: AuditLevel,
  completedElements: string[]
): { met: boolean; missing: string[] } {
  const requirements = LEVEL_REQUIREMENTS[level];
  const missing = requirements.requiredElements.filter(
    el => !completedElements.includes(el)
  );

  return {
    met: missing.length === 0,
    missing
  };
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const AUDIT_LEVELS: AuditLevel[] = ['L0', 'L1', 'L2', 'L3'];

export function getLevelDescription(level: AuditLevel): string {
  return LEVEL_REQUIREMENTS[level].description;
}
