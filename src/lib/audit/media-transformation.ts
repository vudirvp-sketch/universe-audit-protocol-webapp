/**
 * T2.2 — Media Transformation Map
 * Universe Audit Protocol v10.0
 * 
 * Implements transformation prompts for different media types
 * Rule: Transform prompts via map, don't just skip
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MediaType = 'game' | 'novel' | 'film' | 'ttrpg' | 'anime' | 'series';

export type SectionTag = 'CORE' | 'GAME' | 'VISUAL' | 'AUDIO' | 'INTERACTIVE';

export interface MediaTransformation {
  reframeQuestion: string;
  skip: boolean;
  skipReason?: string;
  priorityAdjust: number;
  additionalChecks: string[];
}

export interface SectionConfig {
  id: string;
  name: string;
  tags: SectionTag[];
  description: string;
}

export interface TransformationResult {
  mediaType: MediaType;
  transformedSections: {
    sectionId: string;
    applicable: boolean;
    transformation: MediaTransformation;
  }[];
  skipReasons: string[];
}

// ============================================================================
// SECTION DEFINITIONS
// ============================================================================

const SECTIONS: SectionConfig[] = [
  { id: 'skeleton', name: 'Skeleton Extraction', tags: ['CORE'], description: 'Core narrative structure' },
  { id: 'thematic_law', name: 'Thematic Law', tags: ['CORE'], description: 'Theme integration' },
  { id: 'root_trauma', name: 'Root Trauma', tags: ['CORE'], description: 'Trauma foundation' },
  { id: 'hamartia', name: 'Hamartia', tags: ['CORE'], description: 'Fatal flaw' },
  { id: 'grief_architecture', name: 'Grief Architecture', tags: ['CORE'], description: 'Grief stages' },
  { id: 'character_arcs', name: 'Character Arcs', tags: ['CORE'], description: 'Character development' },
  { id: 'world_consistency', name: 'World Consistency', tags: ['CORE'], description: 'World logic' },
  { id: 'dialogue', name: 'Dialogue Dynamics', tags: ['CORE'], description: 'Dialogue quality' },
  { id: 'mechanics', name: 'Game Mechanics', tags: ['GAME'], description: 'Interactive mechanics' },
  { id: 'player_agency', name: 'Player Agency', tags: ['GAME'], description: 'Player choices' },
  { id: 'visual_narrative', name: 'Visual Narrative', tags: ['VISUAL'], description: 'Visual storytelling' },
  { id: 'pacing_visual', name: 'Visual Pacing', tags: ['VISUAL'], description: 'Visual rhythm' },
  { id: 'sound_design', name: 'Sound Design', tags: ['AUDIO'], description: 'Audio elements' },
  { id: 'branching', name: 'Branching Narrative', tags: ['INTERACTIVE'], description: 'Choice branches' }
];

// ============================================================================
// MEDIA TRANSFORMATION MAPS
// ============================================================================

const MEDIA_TRANSFORMATIONS: Record<MediaType, Record<string, MediaTransformation>> = {
  game: {
    skeleton: { reframeQuestion: 'How does the core structure manifest through gameplay loops?', skip: false, priorityAdjust: 0, additionalChecks: ['gameplay_integration'] },
    thematic_law: { reframeQuestion: 'How is the theme expressed through game mechanics?', skip: false, priorityAdjust: 1, additionalChecks: ['mechanical_theme_resonance'] },
    root_trauma: { reframeQuestion: 'How does the trauma drive player motivation/quests?', skip: false, priorityAdjust: 0, additionalChecks: ['quest_trauma_connection'] },
    hamartia: { reframeQuestion: 'How does the flaw manifest in gameplay choices?', skip: false, priorityAdjust: 0, additionalChecks: ['flaw_as_mechanic'] },
    grief_architecture: { reframeQuestion: 'How do grief stages map to game progression?', skip: false, priorityAdjust: 0, additionalChecks: ['progression_emotional_mapping'] },
    character_arcs: { reframeQuestion: 'How do character arcs intersect with player progression?', skip: false, priorityAdjust: 0, additionalChecks: ['player_character_arc_sync'] },
    world_consistency: { reframeQuestion: 'Is the world logic consistent across exploration?', skip: false, priorityAdjust: 1, additionalChecks: ['exploration_consistency'] },
    dialogue: { reframeQuestion: 'How does dialogue adapt to player choices?', skip: false, priorityAdjust: 0, additionalChecks: ['reactive_dialogue'] },
    mechanics: { reframeQuestion: 'Do mechanics reinforce narrative themes?', skip: false, priorityAdjust: 2, additionalChecks: ['mechanic_theme_reinforcement'] },
    player_agency: { reframeQuestion: 'Do player choices have meaningful narrative impact?', skip: false, priorityAdjust: 2, additionalChecks: ['choice_consequence_weight'] },
    visual_narrative: { reframeQuestion: 'How does environmental design tell the story?', skip: false, priorityAdjust: 1, additionalChecks: ['environmental_storytelling'] },
    pacing_visual: { reframeQuestion: 'Does visual pacing match gameplay rhythm?', skip: false, priorityAdjust: 0, additionalChecks: ['gameplay_visual_sync'] },
    sound_design: { reframeQuestion: 'How does audio enhance immersion and narrative?', skip: false, priorityAdjust: 1, additionalChecks: ['audio_narrative_integration'] },
    branching: { reframeQuestion: 'Do narrative branches have meaningful divergence?', skip: false, priorityAdjust: 2, additionalChecks: ['branch_meaningfulness'] }
  },

  novel: {
    skeleton: { reframeQuestion: 'How is the structure revealed through prose?', skip: false, priorityAdjust: 0, additionalChecks: ['prose_structure_reveal'] },
    thematic_law: { reframeQuestion: 'How is the theme woven through prose and imagery?', skip: false, priorityAdjust: 1, additionalChecks: ['prose_theme_integration'] },
    root_trauma: { reframeQuestion: 'How is trauma revealed through narrative voice?', skip: false, priorityAdjust: 0, additionalChecks: ['voice_trauma_connection'] },
    hamartia: { reframeQuestion: 'How is the flaw developed through internal monologue?', skip: false, priorityAdjust: 0, additionalChecks: ['internal_flaw_development'] },
    grief_architecture: { reframeQuestion: 'How do grief stages structure the narrative arc?', skip: false, priorityAdjust: 0, additionalChecks: ['narrative_grief_structure'] },
    character_arcs: { reframeQuestion: 'How are arcs developed through character voice?', skip: false, priorityAdjust: 1, additionalChecks: ['voice_arc_development'] },
    world_consistency: { reframeQuestion: 'Is worldbuilding consistent through prose?', skip: false, priorityAdjust: 1, additionalChecks: ['prose_worldbuilding'] },
    dialogue: { reframeQuestion: 'Does dialogue reveal character through voice?', skip: false, priorityAdjust: 2, additionalChecks: ['distinctive_dialogue_voice'] },
    mechanics: { reframeQuestion: 'N/A for novels', skip: true, skipReason: 'Game mechanics not applicable to novels', priorityAdjust: -2, additionalChecks: [] },
    player_agency: { reframeQuestion: 'N/A for novels', skip: true, skipReason: 'Player agency not applicable to novels', priorityAdjust: -2, additionalChecks: [] },
    visual_narrative: { reframeQuestion: 'How is visual imagery created through prose?', skip: false, priorityAdjust: 0, additionalChecks: ['prose_visual_imagery'] },
    pacing_visual: { reframeQuestion: 'How does sentence/paragraph rhythm create pacing?', skip: false, priorityAdjust: 0, additionalChecks: ['prose_rhythm_pacing'] },
    sound_design: { reframeQuestion: 'How is auditory imagery created through prose?', skip: false, priorityAdjust: 0, additionalChecks: ['prose_auditory_imagery'] },
    branching: { reframeQuestion: 'N/A for linear novels', skip: true, skipReason: 'Branching not applicable to linear novels', priorityAdjust: -2, additionalChecks: [] }
  },

  film: {
    skeleton: { reframeQuestion: 'How is structure revealed through visual sequencing?', skip: false, priorityAdjust: 0, additionalChecks: ['visual_structure'] },
    thematic_law: { reframeQuestion: 'How is theme expressed through cinematography?', skip: false, priorityAdjust: 1, additionalChecks: ['cinematic_theme'] },
    root_trauma: { reframeQuestion: 'How is trauma shown through visual storytelling?', skip: false, priorityAdjust: 0, additionalChecks: ['visual_trauma'] },
    hamartia: { reframeQuestion: 'How is the flaw shown through actor performance?', skip: false, priorityAdjust: 0, additionalChecks: ['performance_flaw'] },
    grief_architecture: { reframeQuestion: 'How do grief stages structure the film arc?', skip: false, priorityAdjust: 0, additionalChecks: ['film_grief_arc'] },
    character_arcs: { reframeQuestion: 'How are arcs shown through visual change?', skip: false, priorityAdjust: 1, additionalChecks: ['visual_arc'] },
    world_consistency: { reframeQuestion: 'Is production design consistent with world logic?', skip: false, priorityAdjust: 1, additionalChecks: ['production_design_consistency'] },
    dialogue: { reframeQuestion: 'Does dialogue work with visual storytelling?', skip: false, priorityAdjust: 0, additionalChecks: ['dialogue_visual_balance'] },
    mechanics: { reframeQuestion: 'N/A for films', skip: true, skipReason: 'Game mechanics not applicable to films', priorityAdjust: -2, additionalChecks: [] },
    player_agency: { reframeQuestion: 'N/A for films', skip: true, skipReason: 'Player agency not applicable to films', priorityAdjust: -2, additionalChecks: [] },
    visual_narrative: { reframeQuestion: 'How does cinematography tell the story?', skip: false, priorityAdjust: 2, additionalChecks: ['cinematic_storytelling'] },
    pacing_visual: { reframeQuestion: 'How does editing create narrative rhythm?', skip: false, priorityAdjust: 2, additionalChecks: ['editing_rhythm'] },
    sound_design: { reframeQuestion: 'How does the soundtrack enhance narrative?', skip: false, priorityAdjust: 1, additionalChecks: ['soundtrack_narrative'] },
    branching: { reframeQuestion: 'N/A for linear films', skip: true, skipReason: 'Branching not applicable to linear films', priorityAdjust: -2, additionalChecks: [] }
  },

  ttrpg: {
    skeleton: { reframeQuestion: 'How does the structure support GM improvisation?', skip: false, priorityAdjust: 0, additionalChecks: ['gm_flexibility'] },
    thematic_law: { reframeQuestion: 'How can players discover the theme through play?', skip: false, priorityAdjust: 1, additionalChecks: ['player_theme_discovery'] },
    root_trauma: { reframeQuestion: 'How can the trauma drive multiple character backstories?', skip: false, priorityAdjust: 0, additionalChecks: ['multi_character_trauma'] },
    hamartia: { reframeQuestion: 'How can the flaw create dramatic moments at the table?', skip: false, priorityAdjust: 0, additionalChecks: ['table_drama_flaw'] },
    grief_architecture: { reframeQuestion: 'How can grief stages be experienced at the table?', skip: false, priorityAdjust: 0, additionalChecks: ['table_grief_experience'] },
    character_arcs: { reframeQuestion: 'How do arcs develop through player choices?', skip: false, priorityAdjust: 1, additionalChecks: ['player_driven_arcs'] },
    world_consistency: { reframeQuestion: 'Is the world consistent for player exploration?', skip: false, priorityAdjust: 1, additionalChecks: ['explorable_consistency'] },
    dialogue: { reframeQuestion: 'How does the setting support roleplay?', skip: false, priorityAdjust: 1, additionalChecks: ['roleplay_support'] },
    mechanics: { reframeQuestion: 'Do the rules reinforce narrative themes?', skip: false, priorityAdjust: 2, additionalChecks: ['rules_theme_reinforcement'] },
    player_agency: { reframeQuestion: 'Does the setting support player agency?', skip: false, priorityAdjust: 2, additionalChecks: ['setting_agency'] },
    visual_narrative: { reframeQuestion: 'How are visuals presented to players?', skip: false, priorityAdjust: 0, additionalChecks: ['visual_aids'] },
    pacing_visual: { reframeQuestion: 'How does session structure create pacing?', skip: false, priorityAdjust: 0, additionalChecks: ['session_pacing'] },
    sound_design: { reframeQuestion: 'How can audio enhance the table experience?', skip: false, priorityAdjust: 0, additionalChecks: ['table_audio'] },
    branching: { reframeQuestion: 'How does the setting support multiple paths?', skip: false, priorityAdjust: 1, additionalChecks: ['setting_branching'] }
  },

  anime: {
    skeleton: { reframeQuestion: 'How is structure revealed through episode arc?', skip: false, priorityAdjust: 0, additionalChecks: ['episode_structure'] },
    thematic_law: { reframeQuestion: 'How is theme expressed through animation style?', skip: false, priorityAdjust: 1, additionalChecks: ['animation_theme'] },
    root_trauma: { reframeQuestion: 'How is trauma shown through visual metaphor?', skip: false, priorityAdjust: 0, additionalChecks: ['visual_trauma_metaphor'] },
    hamartia: { reframeQuestion: 'How is the flaw shown through animation?', skip: false, priorityAdjust: 0, additionalChecks: ['animated_flaw'] },
    grief_architecture: { reframeQuestion: 'How do grief stages structure the series?', skip: false, priorityAdjust: 0, additionalChecks: ['series_grief_arc'] },
    character_arcs: { reframeQuestion: 'How are arcs developed across episodes?', skip: false, priorityAdjust: 1, additionalChecks: ['episodic_arcs'] },
    world_consistency: { reframeQuestion: 'Is the animated world visually consistent?', skip: false, priorityAdjust: 1, additionalChecks: ['animation_consistency'] },
    dialogue: { reframeQuestion: 'Does dialogue work with animation timing?', skip: false, priorityAdjust: 0, additionalChecks: ['animation_dialogue_timing'] },
    mechanics: { reframeQuestion: 'N/A for anime', skip: true, skipReason: 'Game mechanics not applicable to anime', priorityAdjust: -2, additionalChecks: [] },
    player_agency: { reframeQuestion: 'N/A for anime', skip: true, skipReason: 'Player agency not applicable to anime', priorityAdjust: -2, additionalChecks: [] },
    visual_narrative: { reframeQuestion: 'How does animation style tell the story?', skip: false, priorityAdjust: 2, additionalChecks: ['animation_storytelling'] },
    pacing_visual: { reframeQuestion: 'How does animation timing create rhythm?', skip: false, priorityAdjust: 1, additionalChecks: ['animation_rhythm'] },
    sound_design: { reframeQuestion: 'How does the OST enhance narrative?', skip: false, priorityAdjust: 1, additionalChecks: ['ost_narrative'] },
    branching: { reframeQuestion: 'N/A for linear anime', skip: true, skipReason: 'Branching not applicable to linear anime', priorityAdjust: -2, additionalChecks: [] }
  },

  series: {
    skeleton: { reframeQuestion: 'How is structure revealed across episodes?', skip: false, priorityAdjust: 0, additionalChecks: ['episodic_structure'] },
    thematic_law: { reframeQuestion: 'How is theme developed across seasons?', skip: false, priorityAdjust: 1, additionalChecks: ['seasonal_theme'] },
    root_trauma: { reframeQuestion: 'How is trauma revealed through episodic storytelling?', skip: false, priorityAdjust: 0, additionalChecks: ['episodic_trauma'] },
    hamartia: { reframeQuestion: 'How is the flaw developed across episodes?', skip: false, priorityAdjust: 0, additionalChecks: ['episodic_flaw'] },
    grief_architecture: { reframeQuestion: 'How do grief stages structure seasons?', skip: false, priorityAdjust: 0, additionalChecks: ['seasonal_grief'] },
    character_arcs: { reframeQuestion: 'How are arcs paced across seasons?', skip: false, priorityAdjust: 2, additionalChecks: ['seasonal_arcs'] },
    world_consistency: { reframeQuestion: 'Is world logic consistent across episodes?', skip: false, priorityAdjust: 1, additionalChecks: ['episodic_consistency'] },
    dialogue: { reframeQuestion: 'Does dialogue maintain character voice across episodes?', skip: false, priorityAdjust: 0, additionalChecks: ['episodic_dialogue'] },
    mechanics: { reframeQuestion: 'N/A for series', skip: true, skipReason: 'Game mechanics not applicable to series', priorityAdjust: -2, additionalChecks: [] },
    player_agency: { reframeQuestion: 'N/A for series', skip: true, skipReason: 'Player agency not applicable to series', priorityAdjust: -2, additionalChecks: [] },
    visual_narrative: { reframeQuestion: 'How does cinematography tell the story?', skip: false, priorityAdjust: 1, additionalChecks: ['series_cinematography'] },
    pacing_visual: { reframeQuestion: 'How does episode structure create pacing?', skip: false, priorityAdjust: 1, additionalChecks: ['episode_pacing'] },
    sound_design: { reframeQuestion: 'How does sound design enhance narrative?', skip: false, priorityAdjust: 0, additionalChecks: ['series_sound'] },
    branching: { reframeQuestion: 'N/A for linear series', skip: true, skipReason: 'Branching not applicable to linear series', priorityAdjust: -2, additionalChecks: [] }
  }
};

// ============================================================================
// MAIN TRANSFORMATION FUNCTION
// ============================================================================

/**
 * Applies media transformation to sections
 * Returns transformed prompts and skip information
 */
export function applyMediaTransformation(mediaType: MediaType): TransformationResult {
  const transformations = MEDIA_TRANSFORMATIONS[mediaType];
  const transformedSections: TransformationResult['transformedSections'] = [];
  const skipReasons: string[] = [];

  for (const section of SECTIONS) {
    const transformation = transformations[section.id];
    
    if (transformation) {
      transformedSections.push({
        sectionId: section.id,
        applicable: !transformation.skip,
        transformation
      });

      if (transformation.skip && transformation.skipReason) {
        skipReasons.push(`${section.name}: ${transformation.skipReason}`);
      }
    } else {
      // Default transformation for undefined sections
      transformedSections.push({
        sectionId: section.id,
        applicable: true,
        transformation: {
          reframeQuestion: `Standard analysis for ${section.name}`,
          skip: false,
          priorityAdjust: 0,
          additionalChecks: []
        }
      });
    }
  }

  return {
    mediaType,
    transformedSections,
    skipReasons
  };
}

// ============================================================================
// SECTION APPLICABILITY
// ============================================================================

/**
 * Checks if a section is applicable for a media type
 */
export function isSectionApplicable(sectionId: string, mediaType: MediaType): boolean {
  const transformations = MEDIA_TRANSFORMATIONS[mediaType];
  const transformation = transformations[sectionId];
  
  return transformation ? !transformation.skip : true;
}

/**
 * Gets the reframe question for a section and media type
 */
export function getReframeQuestion(sectionId: string, mediaType: MediaType): string {
  const transformations = MEDIA_TRANSFORMATIONS[mediaType];
  const transformation = transformations[sectionId];
  
  return transformation?.reframeQuestion || `Standard analysis for ${sectionId}`;
}

/**
 * Gets priority adjustment for a section in a media type
 */
export function getPriorityAdjustment(sectionId: string, mediaType: MediaType): number {
  const transformations = MEDIA_TRANSFORMATIONS[mediaType];
  const transformation = transformations[sectionId];
  
  return transformation?.priorityAdjust || 0;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const MEDIA_TYPES: MediaType[] = ['game', 'novel', 'film', 'ttrpg', 'anime', 'series'];

export const SECTION_TAGS: SectionTag[] = ['CORE', 'GAME', 'VISUAL', 'AUDIO', 'INTERACTIVE'];
