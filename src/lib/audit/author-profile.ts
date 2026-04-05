/**
 * T0.2 — Author Profile Routing
 * Universe Audit Protocol v10.0
 * 
 * Implements author profile detection and section priority ordering
 * Profiles: GARDENER, ARCHITECT, HYBRID
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AuthorProfile = 'gardener' | 'architect' | 'hybrid';

export interface ProfileIndicators {
  iterativeDrafts: boolean;
  characterFirst: boolean;
  plotFirst: boolean;
  organicDevelopment: boolean;
  structuredOutlining: boolean;
  themeEmergence: boolean;
  themeDefined: boolean;
  worldbuildingDepth: number; // 0-1 scale
  characterDepth: number; // 0-1 scale
}

export interface ProfileConfig {
  profile: AuthorProfile;
  priorityArray: string[];
  riskFlags: string[];
  strengths: string[];
  weaknesses: string[];
  recommendedApproach: string;
}

export interface SectionOrder {
  sectionId: string;
  priority: number;
  reason: string;
}

// ============================================================================
// AUDIT SECTIONS
// ============================================================================

const AUDIT_SECTIONS = [
  'skeleton_extraction',      // L0 — Core structure
  'thematic_law',             // L1 — Theme + World Law
  'root_trauma',              // L1 — Trauma foundation
  'hamartia',                 // L1 — Fatal flaw
  'grief_architecture',       // L3 — Grief stages
  'character_arcs',           // L2 — Character development
  'world_consistency',        // L2 — World logic
  'dialogue_dynamics',        // L2 — Dialogue quality
  'comparative_analysis',     // L2 — Reference comparison
  'new_elements',             // L2 — New element validation
  'cult_potential',           // L2 — Cult potential
  'final_synthesis'           // L3 — Final integration
] as const;

// ============================================================================
// PROFILE CONFIGURATIONS
// ============================================================================

const GARDENER_CONFIG: ProfileConfig = {
  profile: 'gardener',
  priorityArray: [
    'skeleton_extraction',
    'character_arcs',
    'root_trauma',
    'thematic_law',
    'dialogue_dynamics',
    'hamartia',
    'grief_architecture',
    'world_consistency',
    'comparative_analysis',
    'new_elements',
    'cult_potential',
    'final_synthesis'
  ],
  riskFlags: [
    'theme_inconsistency',
    'plot_holes_from_organic_growth',
    'world_logic_gaps',
    'underdeveloped_thematic_law'
  ],
  strengths: [
    'Organic character development',
    'Natural dialogue',
    'Emotional authenticity',
    'Emergent themes'
  ],
  weaknesses: [
    'Structural inconsistencies',
    'World logic gaps',
    'Theme drift',
    'Pacing issues'
  ],
  recommendedApproach: 'Focus on structure validation while preserving organic strengths'
};

const ARCHITECT_CONFIG: ProfileConfig = {
  profile: 'architect',
  priorityArray: [
    'skeleton_extraction',
    'thematic_law',
    'world_consistency',
    'root_trauma',
    'hamartia',
    'grief_architecture',
    'character_arcs',
    'dialogue_dynamics',
    'new_elements',
    'comparative_analysis',
    'cult_potential',
    'final_synthesis'
  ],
  riskFlags: [
    'forced_character_beats',
    'mechanical_dialogue',
    'over_structured_emotions',
    'predictable_arcs'
  ],
  strengths: [
    'Consistent world logic',
    'Clear thematic throughline',
    'Structured pacing',
    'Coherent plot mechanics'
  ],
  weaknesses: [
    'Mechanical character development',
    'Dialogue may feel scripted',
    'Emotional beats predictable',
    'Risk of formulaic structure'
  ],
  recommendedApproach: 'Validate emotional authenticity while maintaining structural integrity'
};

const HYBRID_CONFIG: ProfileConfig = {
  profile: 'hybrid',
  priorityArray: [
    'skeleton_extraction',
    'thematic_law',
    'root_trauma',
    'character_arcs',
    'hamartia',
    'world_consistency',
    'dialogue_dynamics',
    'grief_architecture',
    'new_elements',
    'comparative_analysis',
    'cult_potential',
    'final_synthesis'
  ],
  riskFlags: [
    'method_inconsistency',
    'mixed_signal_structure',
    'unclear_priority',
    'balancing_act_failures'
  ],
  strengths: [
    'Balanced structure and organic elements',
    'Flexible approach',
    'Multiple strengths from both profiles',
    'Adaptive development'
  ],
  weaknesses: [
    'Risk of inconsistency in approach',
    'May lack clear identity',
    'Balancing act can create gaps',
    'Method switching confusion'
  ],
  recommendedApproach: 'Maintain balance while checking for method inconsistency'
};

// ============================================================================
// PROFILE CALCULATION
// ============================================================================

/**
 * Calculates the author profile based on creation indicators
 * 
 * Decision Logic:
 * - GARDENER: character_first, organic_development, theme_emergence, high character_depth
 * - ARCHITECT: plot_first, structured_outlining, theme_defined, high worldbuilding_depth
 * - HYBRID: Mixed indicators or balanced scores
 */
export function calculateAuthorProfile(indicators: ProfileIndicators): AuthorProfile {
  let gardenerScore = 0;
  let architectScore = 0;

  // GARDENER indicators
  if (indicators.iterativeDrafts) gardenerScore += 1;
  if (indicators.characterFirst) gardenerScore += 2;
  if (indicators.organicDevelopment) gardenerScore += 2;
  if (indicators.themeEmergence) gardenerScore += 1;
  if (indicators.characterDepth > 0.7) gardenerScore += 1;

  // ARCHITECT indicators
  if (indicators.plotFirst) architectScore += 2;
  if (indicators.structuredOutlining) architectScore += 2;
  if (indicators.themeDefined) architectScore += 1;
  if (indicators.worldbuildingDepth > 0.7) architectScore += 1;

  // Determine profile
  const totalScore = gardenerScore + architectScore;
  
  if (totalScore === 0) {
    return 'hybrid'; // Default when no clear indicators
  }

  const gardenerRatio = gardenerScore / totalScore;

  if (gardenerRatio > 0.65) {
    return 'gardener';
  } else if (gardenerRatio < 0.35) {
    return 'architect';
  } else {
    return 'hybrid';
  }
}

/**
 * Returns the profile configuration for a given profile type
 */
export function getProfileConfig(profile: AuthorProfile): ProfileConfig {
  switch (profile) {
    case 'gardener':
      return GARDENER_CONFIG;
    case 'architect':
      return ARCHITECT_CONFIG;
    case 'hybrid':
      return HYBRID_CONFIG;
    default:
      throw new Error(`Unknown author profile: ${profile}`);
  }
}

// ============================================================================
// SECTION REORDERING
// ============================================================================

/**
 * Reorders audit sections based on author profile priority
 * Returns ordered sections with priority scores and reasons
 */
export function reorderSectionsByPriority(profile: AuthorProfile): SectionOrder[] {
  const config = getProfileConfig(profile);
  const orders: SectionOrder[] = [];

  config.priorityArray.forEach((sectionId, index) => {
    orders.push({
      sectionId,
      priority: config.priorityArray.length - index,
      reason: getPriorityReason(profile, sectionId)
    });
  });

  return orders;
}

/**
 * Returns the reason for a section's priority in a given profile
 */
function getPriorityReason(profile: AuthorProfile, sectionId: string): string {
  const reasons: Record<AuthorProfile, Record<string, string>> = {
    gardener: {
      'skeleton_extraction': 'Foundation check for organic development',
      'character_arcs': 'Primary strength area - validate early',
      'root_trauma': 'Character foundation aligns with organic approach',
      'thematic_law': 'Check for theme emergence consistency',
      'dialogue_dynamics': 'Natural dialogue is a key strength',
      'hamartia': 'Character flaw development',
      'grief_architecture': 'Emotional structure validation',
      'world_consistency': 'Risk area - check for gaps',
      'comparative_analysis': 'Reference validation',
      'new_elements': 'New element validation',
      'cult_potential': 'Overall potential assessment',
      'final_synthesis': 'Integration of findings'
    },
    architect: {
      'skeleton_extraction': 'Foundation check for structured development',
      'thematic_law': 'Primary strength - validate early',
      'world_consistency': 'World logic is a key strength',
      'root_trauma': 'Thematic trauma foundation',
      'hamartia': 'Structural flaw integration',
      'grief_architecture': 'Emotional architecture validation',
      'character_arcs': 'Risk area - check for mechanical beats',
      'dialogue_dynamics': 'Risk area - check for naturalness',
      'new_elements': 'Structural integration check',
      'comparative_analysis': 'Reference validation',
      'cult_potential': 'Overall potential assessment',
      'final_synthesis': 'Integration of findings'
    },
    hybrid: {
      'skeleton_extraction': 'Foundation check for balanced development',
      'thematic_law': 'Core structural element',
      'root_trauma': 'Foundation for both character and theme',
      'character_arcs': 'Balance character development',
      'hamartia': 'Integration point',
      'world_consistency': 'Balance world logic',
      'dialogue_dynamics': 'Natural dialogue check',
      'grief_architecture': 'Emotional structure',
      'new_elements': 'New element validation',
      'comparative_analysis': 'Reference validation',
      'cult_potential': 'Overall potential assessment',
      'final_synthesis': 'Integration of findings'
    }
  };

  return reasons[profile]?.[sectionId] || 'Standard audit section';
}

// ============================================================================
// RISK FLAG DETECTION
// ============================================================================

/**
 * Checks for profile-specific risk flags in audit results
 */
export function detectProfileRisks(
  profile: AuthorProfile,
  auditResults: Record<string, unknown>
): { flag: string; severity: 'low' | 'medium' | 'high'; recommendation: string }[] {
  const config = getProfileConfig(profile);
  const detectedRisks: { flag: string; severity: 'low' | 'medium' | 'high'; recommendation: string }[] = [];

  // Profile-specific risk detection
  if (profile === 'gardener') {
    if (auditResults.themeInconsistency) {
      detectedRisks.push({
        flag: 'theme_inconsistency',
        severity: 'high',
        recommendation: 'Review theme emergence for consistency - consider thematic mapping'
      });
    }
    if (auditResults.worldLogicGaps) {
      detectedRisks.push({
        flag: 'world_logic_gaps',
        severity: 'medium',
        recommendation: 'Fill world logic gaps while preserving organic elements'
      });
    }
  }

  if (profile === 'architect') {
    if (auditResults.mechanicalDialogue) {
      detectedRisks.push({
        flag: 'mechanical_dialogue',
        severity: 'medium',
        recommendation: 'Review dialogue for naturalness - add character voice variations'
      });
    }
    if (auditResults.predictableArcs) {
      detectedRisks.push({
        flag: 'predictable_arcs',
        severity: 'low',
        recommendation: 'Consider subverting expectations at key beats'
      });
    }
  }

  if (profile === 'hybrid') {
    if (auditResults.methodInconsistency) {
      detectedRisks.push({
        flag: 'method_inconsistency',
        severity: 'medium',
        recommendation: 'Check for inconsistent approach between sections'
      });
    }
  }

  return detectedRisks;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const PROFILE_LABELS: Record<AuthorProfile, string> = {
  gardener: 'GARDENER — Organic Development Profile',
  architect: 'ARCHITECT — Structured Development Profile',
  hybrid: 'HYBRID — Balanced Development Profile'
};

export const PROFILE_DESCRIPTIONS: Record<AuthorProfile, string> = {
  gardener: 'Authors who develop organically, letting characters and themes emerge naturally through iterative drafts.',
  architect: 'Authors who plan structure first, defining themes and world logic before developing characters.',
  hybrid: 'Authors who combine both approaches, balancing organic development with structured planning.'
};
