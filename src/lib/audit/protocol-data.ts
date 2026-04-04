// Universe Audit Protocol v10.0 - Protocol Data
import type { 
  ChecklistItem, 
  GlossaryTerm, 
  GriefStage, 
  AuthorQuestion,
  VitalityCriteria,
  MediaTag,
  MediaType
} from './types';

// Master Checklist - 52 items with media tags
export const MASTER_CHECKLIST: ChecklistItem[] = [
  // Block A: Structure (7) - L1
  { id: 'A1', block: 'A', text: 'Thematic Law formulated as physical rule, affects physics/economy', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A2', block: 'A', text: 'Root Trauma defined and explains all ideologies', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A3', block: 'A', text: 'Hamartia - finale flows from protagonist nature', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A4', block: 'A', text: '3 Pillars - closed cycle', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A5', block: 'A', text: 'Author\'s Prohibition fixed', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A6', block: 'A', text: 'Target Experience - conflicting emotions, not single emotion', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'A7', block: 'A', text: 'Central Question - one, throughout entire story', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block B: Connectedness (8) - L1
  { id: 'B1', block: 'B', text: 'N×N Matrix: no empty cells', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B2', block: 'B', text: 'Faction Matrix: filled with verbs', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B3', block: 'B', text: 'Each faction ≥4/6 vitality criteria', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B4', block: 'B', text: 'Each element: Ripple Effect ≥2', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B5', block: 'B', text: 'Spatial memory: trace without explanation', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B6', block: 'B', text: 'Three handshakes rule', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B7', block: 'B', text: 'No hanging content', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'B8', block: 'B', text: 'Economic Arrow for all phenomena', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block C: Vitality (7) - L1/L2
  { id: 'C1', block: 'C', text: '13/17 vitality criteria', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C2', block: 'C', text: 'NPCs argue, don\'t explain', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C3', block: 'C', text: 'Daily life, economy, superstitions present', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C4', block: 'C', text: '5 MDA+OT levels aligned', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C5', block: 'C', text: 'Body anchor in each key scene', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C6', block: 'C', text: 'Moment of silence/slow time', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'C7', block: 'C', text: 'Unexplained details for atmosphere', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },

  // Block D: Characters (7) - L1/L2
  { id: 'D1', block: 'D', text: 'Each key character: systematic flaw + hamartia', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D2', block: 'D', text: 'Protagonist: ≤3 Mary Sue test failures', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D3', block: 'D', text: 'Price of Greatness hits identity', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D4', block: 'D', text: 'Antagonist: internal logic without villain motivation', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D5', block: 'D', text: 'Embodiment and psych-verisimilitude 5/5', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D6', block: 'D', text: 'Beliefs as perception filter', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },
  { id: 'D7', block: 'D', text: 'None of three anti-patterns present', tag: 'CORE', level: 'L1/L2', status: 'PENDING', applicable: true },

  // Block E: Systems and Logic (6) - L1
  { id: 'E1', block: 'E', text: 'Magic passed Sanderson test + Occam\'s Razor', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E2', block: 'E', text: 'Equivalent exchange', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E3', block: 'E', text: 'System connected to history, politics, daily life', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E4', block: 'E', text: '7 types of logic holes checked', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E5', block: 'E', text: 'King\'s Immunity - passed', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'E6', block: 'E', text: 'Villain is smarter - passed', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block F: New Elements (2) - L1
  { id: 'F1', block: 'F', text: '5 checks when adding', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },
  { id: 'F2', block: 'F', text: '5 levels of touch', tag: 'CORE', level: 'L1', status: 'PENDING', applicable: true },

  // Block G: Cult Status (1) - L4
  { id: 'G1', block: 'G', text: '8+/11 cult criteria', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },

  // Block H: Scenes (1) - L2
  { id: 'H1', block: 'H', text: 'Scene test: ≥9/12, including Misdirection for starters', tag: 'CORE', level: 'L2', status: 'PENDING', applicable: true },

  // Block I: Thematic Physics (2) - L1/L3
  { id: 'I1', block: 'I', text: 'Theme affects physics/magic/economy', tag: 'CORE', level: 'L1/L3', status: 'PENDING', applicable: true },
  { id: 'I2', block: 'I', text: 'Key mechanics - ontological encoding level', tag: 'GAME', level: 'L1/L3', status: 'PENDING', applicable: true },

  // Block J: Grief Architecture (3) - L3
  { id: 'J1', block: 'J', text: 'All 5 stages materialized × 4 levels', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },
  { id: 'J2', block: 'J', text: 'Dominant stage defined', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },
  { id: 'J3', block: 'J', text: 'Character psychotypes - no stage duplicates', tag: 'CORE', level: 'L3', status: 'PENDING', applicable: true },

  // Block K: Meta-integration (4) - L4
  { id: 'K1', block: 'K', text: 'Three layers passed destruction test', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K2', block: 'K', text: 'Author-in-lore has price', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K3', block: 'K', text: 'Cornelian finale: value vs value', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'K4', block: 'K', text: 'Agent mirror integrated', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },

  // Block L: Narrative Infrastructure (3) - L2/L3
  { id: 'L1', block: 'L', text: 'All 4 types of narrative debt paid', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true },
  { id: 'L2', block: 'L', text: 'Diegetic violations - conscious with justification', tag: 'GAME|VISUAL', level: 'L2/L3', status: 'PENDING', applicable: true },
  { id: 'L3', block: 'L', text: 'Misdirection: false exposition + anomalies + hook', tag: 'CORE', level: 'L2/L3', status: 'PENDING', applicable: true },

  // Block M: Finale and Authorship (3) - L4
  { id: 'M1', block: 'M', text: 'Final choice physically changes world', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'M2', block: 'M', text: 'Author self-audit passed', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
  { id: 'M3', block: 'M', text: 'Story knows its finale and doesn\'t extend for extension\'s sake', tag: 'CORE', level: 'L4', status: 'PENDING', applicable: true },
];

// Glossary with key terms
export const GLOSSARY: GlossaryTerm[] = [
  {
    termRu: 'Гамартия',
    termEn: 'Hamartia',
    definition: 'Fatal flaw that is both character\'s strength and cause of downfall',
    operationalCheck: 'Does the flaw enable success AND cause the finale?'
  },
  {
    termRu: 'Садовник',
    termEn: 'Gardener',
    definition: 'Author profile: characters drive plot, discovery writing',
    operationalCheck: 'Can characters change the ending by their choices?'
  },
  {
    termRu: 'Архитектор',
    termEn: 'Architect',
    definition: 'Author profile: plot drives characters, structured planning',
    operationalCheck: 'Do characters serve pre-determined plot points?'
  },
  {
    termRu: 'Архитектура Горя',
    termEn: 'Grief Architecture',
    definition: '5 stages of grief as structural skeleton (Denial→Anger→Bargaining→Depression→Acceptance)',
    operationalCheck: 'Is each stage materialized across 4 levels (Character+Location+Mechanic+Act)?'
  },
  {
    termRu: 'Тематический Закон',
    termEn: 'Thematic Law',
    definition: 'Theme expressed as physical law of the world',
    operationalCheck: 'Does removing the theme break world physics/economy (not just plot)?'
  },
  {
    termRu: 'Корнелианская дилемма',
    termEn: 'Cornelian Dilemma',
    definition: 'Choice between two values where both options are valid and irreversible',
    operationalCheck: 'Are both options logically defensible? Is there a third path?'
  },
  {
    termRu: 'Телесность',
    termEn: 'Embodiment/Corporeality',
    definition: 'Physical sensations, limitations, logistics grounding narrative',
    operationalCheck: 'Is there fatigue, pain, smell, or money in key scenes?'
  },
  {
    termRu: 'Мэри Сью',
    termEn: 'Mary Sue',
    definition: 'Character without meaningful flaws or consequences',
    operationalCheck: 'Score ≤3/8 on Mary Sue test?'
  },
  {
    termRu: 'Корневая Травма',
    termEn: 'Root Trauma',
    definition: 'Event that broke the previous order and created the current world state',
    operationalCheck: 'Does the trauma explain all major ideologies and conflicts?'
  },
  {
    termRu: 'Зеркало агента',
    termEn: 'Agent Mirror',
    definition: 'Narrative device that makes audience reflect on their own life',
    operationalCheck: 'Does the finale prompt self-question in audience a month later?'
  },
  {
    termRu: 'MDA+OT',
    termEn: 'MDA+OT Framework',
    definition: 'Mechanics, Dynamics, Aesthetics + Ontology, Telos (5 levels of narrative)',
    operationalCheck: 'Are all 5 levels present and aligned with each other?'
  },
  {
    termRu: 'Ripple Effect',
    termEn: 'Ripple Effect',
    definition: 'How many other elements break when one element is removed',
    operationalCheck: 'Does removing an element break ≥2 other elements?'
  },
];

// Grief Stage Definitions
export const GRIEF_STAGES: Record<GriefStage, {
  nameRu: string;
  nameEn: string;
  materialization: string;
  fourLevels: string;
  verificationQuestion: string;
}> = {
  denial: {
    nameRu: 'Отрицание',
    nameEn: 'Denial',
    materialization: 'Alternative reality / false paradise',
    fourLevels: 'Character + Location + Mechanic + Act',
    verificationQuestion: 'Is there "beauty" that the agent initially loves?'
  },
  anger: {
    nameRu: 'Гнев',
    nameEn: 'Anger',
    materialization: 'Aggressive defense system / rage as physics',
    fourLevels: 'Character + Location + Mechanic + Act',
    verificationQuestion: 'Is there a mechanic where rage changes reality?'
  },
  bargaining: {
    nameRu: 'Торг',
    nameEn: 'Bargaining',
    materialization: 'Sacrificial rituals / contracts',
    fourLevels: 'Character + Location + Mechanic + Act',
    verificationQuestion: 'Is there a "deal" the agent makes with themselves?'
  },
  depression: {
    nameRu: 'Депрессия',
    nameEn: 'Depression',
    materialization: 'Paralysis / dead loops / frozen time',
    fourLevels: 'Character + Location + Mechanic + Act',
    verificationQuestion: 'Is there a place where time literally stops?'
  },
  acceptance: {
    nameRu: 'Принятие',
    nameEn: 'Acceptance',
    materialization: 'Final choice without victory - only transformation',
    fourLevels: 'Character + Location + Mechanic + Act',
    verificationQuestion: 'Does the choice change not the world, but who the agent remains?'
  }
};

// Logic Hole Types (7 types)
export const LOGIC_HOLE_TYPES = [
  { type: 'motivation', nameRu: 'Дыра мотивации', nameEn: 'Motivation Hole', symptom: 'Antagonist didn\'t do the obvious earlier', quickFix: 'They didn\'t know / were waiting for conditions' },
  { type: 'competence', nameRu: 'Дыра компетентности', nameEn: 'Competence Hole', symptom: 'Smart character becomes stupid for plot', quickFix: 'Information barrier' },
  { type: 'scale', nameRu: 'Дыра масштаба', nameEn: 'Scale Hole', symptom: 'Small event → disproportionate consequences', quickFix: 'Intermediate links' },
  { type: 'resources', nameRu: 'Дыра ресурсов', nameEn: 'Resources Hole', symptom: 'Army without supply', quickFix: 'Logistical problem' },
  { type: 'memory', nameRu: 'Дыра памяти', nameEn: 'Memory Hole', symptom: 'World forgot key event', quickFix: 'Silencing mechanism' },
  { type: 'ideology', nameRu: 'Идеологическая дыра', nameEn: 'Ideology Hole', symptom: 'Faction contradicts its ideology', quickFix: 'Internal split' },
  { type: 'time', nameRu: 'Дыра времени', nameEn: 'Time Hole', symptom: 'Chronology doesn\'t hold up', quickFix: 'Revise tempo' },
] as const;

// Vitality Criteria (17 criteria)
export const VITALITY_CRITERIA: VitalityCriteria[] = [
  { id: 1, name: 'Interdependence', test: 'Remove → breaks ≥2 others', passed: null },
  { id: 2, name: 'Living NPCs', test: 'Defend position, don\'t retell lore', passed: null },
  { id: 3, name: 'Mandatory Choice', test: 'Silence is also a choice with price', passed: null },
  { id: 4, name: 'Forbidden Strategy', test: 'Agent can "break" system by logic', passed: null },
  { id: 5, name: 'No Free Lunch', test: 'Every power has painful price', passed: null },
  { id: 6, name: 'World Without Agent', test: 'Existed before and continues after', passed: null },
  { id: 7, name: 'World Resistance', test: 'Resists even correct choices', passed: null },
  { id: 8, name: 'World Memory', test: 'Consequences visible later in other context', passed: null },
  { id: 9, name: 'News Cycle', test: 'Leave for a year - wars without hero', passed: null },
  { id: 10, name: 'Random Passerby', test: 'NPCs have life outside protagonist', passed: null },
  { id: 11, name: 'King\'s Immunity', test: 'Strongest structure has vulnerability', passed: null },
  { id: 12, name: 'Occam\'s Razor', test: 'Explained why people use shovels', passed: null },
  { id: 13, name: 'Equivalent Exchange', test: 'Victory without price impossible', passed: null },
  { id: 14, name: 'Tragedy Without Villain', test: 'Incompatible truths, not evil intent', passed: null },
  { id: 15, name: 'Embodiment', test: 'Body: tired, sweat, sick', passed: null },
  { id: 16, name: 'Time Outside Plot', test: 'Yesterday and tomorrow without hero', passed: null },
  { id: 17, name: 'Unexplained Detail', test: 'Elements without explanation work on atmosphere', passed: null },
];

// Author Profile Questions (7 questions with weights)
export const AUTHOR_QUESTIONS: AuthorQuestion[] = [
  { id: 'Q1', text: 'When a character "must" do something stupid for the plot — do you look for a way to make it organic rather than just writing the scene?', weight: 1.0, isKeySignal: false },
  { id: 'Q2', text: 'Do you know how characters behave in situations not described in the narrative?', weight: 1.0, isKeySignal: false },
  { id: 'Q3', text: 'Did plot twists emerge because characters arrived at them, not because you planned them in advance?', weight: 1.5, isKeySignal: true },
  { id: 'Q4', text: 'Have you ever been surprised by your own character\'s action?', weight: 1.0, isKeySignal: false },
  { id: 'Q5', text: 'Could the final scene have changed if one key character made a different decision at the midpoint?', weight: 1.5, isKeySignal: true },
  { id: 'Q6', text: 'Does the antagonist do the right things in your eyes — by their own logic?', weight: 1.0, isKeySignal: false },
  { id: 'Q7', text: 'Did the tragedy grow from the character\'s nature, not from plot necessity?', weight: 1.5, isKeySignal: true },
];

// Cult Status Criteria (11 criteria)
export const CULT_CRITERIA = [
  { id: 1, name: 'Iceberg Lore', description: 'Surface + 3-4 hidden layers', weight: 'required' },
  { id: 2, name: 'Resistance to Understanding', description: 'Always remains a "bottom"', weight: 'required' },
  { id: 3, name: 'Interpretation Provocation', description: 'Different people, different meanings', weight: 'high' },
  { id: 4, name: 'Aesthetic Uniqueness', description: 'Recognizable by fragment', weight: 'high' },
  { id: 5, name: 'Antagonist/Faction You Want to Play', description: 'Players want to experience other side', weight: 'high' },
  { id: 6, name: 'Finale Reinterprets Beginning', description: 'Opening gains new meaning', weight: 'medium' },
  { id: 7, name: 'Uncomfortable Truth', description: 'No moral indulgence', weight: 'medium' },
  { id: 8, name: 'World Expands Logically', description: 'New content fits naturally', weight: 'medium' },
  { id: 9, name: 'Memorable Symbol', description: 'Artifact/place remembered without explanation', weight: 'medium' },
  { id: 10, name: 'Theme Remains Relevant', description: 'Topic meaningful outside narrative', weight: 'low' },
  { id: 11, name: 'Unexplained Depth Enhances', description: 'Mystery helps, not irritates', weight: 'medium' },
] as const;

// Screening Questions (7 questions)
export const SCREENING_QUESTIONS = [
  { id: 1, question: 'Can the world\'s theme be formulated as a rule ("In this world [X] always leads to [Y]")?', flagOnNo: 'Full audit §0, §1.4' },
  { id: 2, question: 'If you remove the protagonist — does the world continue living (routine, history, conflicts without hero)?', flagOnNo: 'Critical §3, §4' },
  { id: 3, question: 'Is there at least one scene where a character is tired, paid money, or felt a smell?', flagOnNo: 'Required §1.5, §5' },
  { id: 4, question: 'Does the key character carry a trait that is simultaneously their strength and their destruction?', flagOnNo: 'Critical §6' },
  { id: 5, question: 'Is there a moment where the "right" choice also has a painful price?', flagOnNo: 'Required §2, §16' },
  { id: 6, question: 'Does the antagonist (or main threat) act by logic that can be understood and even accepted?', flagOnNo: '§6, §8' },
  { id: 7, question: 'Can the finale not be rewritten to a "happy ending" without destroying the meaning of the entire story?', flagOnNo: 'Critical §16' },
] as const;

// Media type display names
export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  game: 'Game (RPG/Narrative)',
  novel: 'Novel/Literature',
  film: 'Film',
  anime: 'Anime',
  series: 'TV Series',
  ttrpg: 'TTRPG/Tabletop'
};

// Audit mode descriptions
export const AUDIT_MODE_DESCRIPTIONS = {
  conflict: {
    name: 'Conflict Mode',
    nameRu: 'Режим Конфликта',
    description: 'Western structure, Hero\'s Journey, conflict as driver. Antagonist exists, story moves toward victory/defeat.',
    questions: 'Mostly YES to: external antagonist?, victory/defeat trajectory?, external conflict?'
  },
  kishō: {
    name: 'Kishō Mode',
    nameRu: 'Режим Кишō',
    description: 'Structure without conflict, perspective shift as driver. Ki: immerse in state. Shō: deepen through details. Ten: cognitive shift. Ketsu: resonance, not resolution.',
    questions: 'Mostly NO to: antagonist?, victory trajectory?, external conflict?'
  },
  hybrid: {
    name: 'Hybrid Mode',
    nameRu: 'Гибридный Режим',
    description: 'Grief Architecture as foundation, antagonist as symptom not cause. Mixes external and internal conflict.',
    questions: 'Mixed answers: some conflict elements, some internal focus.'
  }
};

// Thresholds
export const GATE_THRESHOLD = 60; // 60% required to pass each gate
export const VITALITY_THRESHOLD = 13; // 13/17 = living world
export const CULT_THRESHOLD = 8; // 8/11 = cult potential
export const MARY_SUE_THRESHOLD = 3; // ≤3/8 = acceptable

// Helper function to get level from block
export function getLevelFromBlock(block: string): 'L1' | 'L2' | 'L3' | 'L4' | 'L1/L2' | 'L1/L3' | 'L2/L3' | 'L2/L4' {
  const item = MASTER_CHECKLIST.find(i => i.block === block);
  return item?.level || 'L1';
}

// Helper to check if tag is applicable to media type
export function isTagApplicable(tag: MediaTag | `${MediaTag}|${MediaTag}`, mediaType: MediaType): boolean {
  if (tag === 'CORE') return true;
  
  if (tag.includes('|')) {
    const tags = tag.split('|') as MediaTag[];
    return tags.includes('CORE') || isTagInMediaType(tags, mediaType);
  }
  
  return isTagInMediaType([tag as MediaTag], mediaType);
}

function isTagInMediaType(tags: MediaTag[], mediaType: MediaType): boolean {
  if (tags.includes('GAME') && mediaType === 'game') return true;
  if (tags.includes('VISUAL') && ['film', 'anime', 'series'].includes(mediaType)) return true;
  return false;
}

// Filter checklist by media type
export function filterChecklistByMedia(checklist: ChecklistItem[], mediaType: MediaType): ChecklistItem[] {
  return checklist.map(item => ({
    ...item,
    applicable: isTagApplicable(item.tag, mediaType)
  }));
}
