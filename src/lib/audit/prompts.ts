// Universe Audit Protocol v10.0 - AI Prompts
import type { MediaType, AuditMode, AuthorProfileAnswers, Skeleton, GriefStage } from './types';

/**
 * System prompt for the audit AI
 */
export const AUDIT_SYSTEM_PROMPT = `You are an expert narrative auditor implementing the Universe Audit Protocol v10.0.

Your role is to analyze fictional worlds/narratives through 4 hierarchical levels with strict gating:
- L1 (Mechanism): "Does the world work as a system?" - Basic coherence, logic, economy
- L2 (Body): "Is there embodiment and consequences?" - Trust, routine, spatial memory  
- L3 (Psyche): "Does the world work as a symptom?" - Grief architecture, character depth
- L4 (Meta): "Does it ask a question about the agent's real life?" - Mirror, cult status, authorship ethics

CRITICAL RULES:
1. Each level requires ≥60% score to proceed to next level
2. If L1 < 60%, STOP and provide prioritized fix list - do NOT continue to L2
3. Each checklist item has three states: PASS / FAIL / INSUFFICIENT_DATA
4. Every PASS must include: direct citation + functional_role explanation
5. Media-specific items should be filtered before scoring

OUTPUT FORMAT:
- Pass 1: Human-readable markdown report (15 sections)
- Pass 2: Pure JSON with all data

Be thorough, critical, and evidence-based. Avoid positivity bias.`;

/**
 * Prompt for skeleton extraction
 */
export function getSkeletonExtractionPrompt(narrative: string, mediaType: MediaType): string {
  return `Extract the narrative skeleton from this ${mediaType} concept/narrative:

"""
${narrative}
"""

Extract the following 8 structural elements:

1. **Thematic Law**: One question expressed as a physical law of the world
   - Test: Does removing the theme break physics/economy or just plot?

2. **Root Trauma**: Event that broke the previous order
   - Without trauma: world is static, ideologies are cardboard

3. **Hamartia of Protagonist**: Character trait that inevitably leads to the finale
   - Does the finale flow from hamartia? If not, tragedy is accidental

4. **3 Untouchable Pillars**: Cycle A→B→C→A without which world is not itself
   - Non-cyclic = amorphous world

5. **Emotional Engine**: Dominant grief stage of the world
   - No dominant = emotionally neutral world

6. **Author's Prohibition**: What the concept explicitly avoids
   - Protection from "improvements" that stray from vision

7. **Target Experience**: What the agent feels at the finale
   - Single emotion = failure; conflicting feelings = success

8. **Central Question**: One question the protagonist carries throughout
   - No question = no reason to follow

Return as JSON with keys: thematicLaw, rootTrauma, hamartia, pillars (array of 3 strings), emotionalEngine (one of: denial, anger, bargaining, depression, acceptance), authorProhibition, targetExperience, centralQuestion

If any element cannot be extracted, use null for that field.`;
}

/**
 * Prompt for quick screening
 */
export function getScreeningPrompt(narrative: string): string {
  return `Perform quick screening on this narrative concept (answer only YES/NO):

"""
${narrative}
"""

Answer these 7 questions:

1. Can the world's theme be formulated as a rule ("In this world [X] always leads to [Y]")?
   - If NO: Flag for full audit §0, §1.4

2. If you remove the protagonist — does the world continue living (routine, history, conflicts without hero)?
   - If NO: Critical §3, §4

3. Is there at least one scene where a character is tired, paid money, or felt a smell?
   - If NO: Required §1.5, §5

4. Does the key character carry a trait that is simultaneously their strength and their destruction?
   - If NO: Critical §6

5. Is there a moment where the "right" choice also has a painful price?
   - If NO: Required §2, §16

6. Does the antagonist (or main threat) act by logic that can be understood and even accepted?
   - If NO: §6, §8

7. Can the finale not be rewritten to a "happy ending" without destroying the meaning of the entire story?
   - If NO: Critical §16

Return as JSON:
{
  "answers": [true/false for each question 1-7],
  "flags": ["list of flagged sections"],
  "recommendation": "ready_for_audit" | "requires_sections" | "stop_return_to_skeleton"
}

Scoring:
- 0-1 NO: "ready_for_audit"
- 2-3 NO: "requires_sections"  
- 4+ NO: "stop_return_to_skeleton"`;
}

/**
 * Prompt for determining audit mode
 */
export function getAuditModePrompt(narrative: string): string {
  return `Determine the audit mode for this narrative:

"""
${narrative}
"""

Answer these 3 questions:

1. Is there an antagonist (external hostile force) in the narrative?
2. Does the story move toward victory/defeat, not toward awareness?
3. Is the character conflict external (they vs something) or internal (they vs themselves)?

Based on answers:
- Mostly YES → "conflict" mode (Western structure, Hero's Journey, conflict as driver)
- Mostly NO → "kishō" mode (structure without conflict, perspective shift as driver)
- Mixed → "hybrid" mode (Grief Architecture as foundation, antagonist as symptom)

Return as JSON:
{
  "hasAntagonist": true/false,
  "victoryTrajectory": true/false,
  "externalConflict": true/false,
  "mode": "conflict" | "kishō" | "hybrid",
  "reasoning": "brief explanation"
}`;
}

/**
 * Prompt for L1 (Mechanism) evaluation
 */
export function getL1EvaluationPrompt(
  narrative: string, 
  skeleton: Skeleton,
  mediaType: MediaType,
  checklist: string
): string {
  return `Evaluate L1 (Mechanism) level for this ${mediaType}:

SKELETON:
${JSON.stringify(skeleton, null, 2)}

NARRATIVE:
"""
${narrative}
"""

L1 CHECKLIST (applicable items only):
${checklist}

For each applicable checklist item, evaluate:
- Status: PASS / FAIL / INSUFFICIENT_DATA
- Evidence: Direct quote from narrative (if available)
- Functional Role: How this serves the criterion functionally

CRITICAL RULES:
1. Do NOT score INSUFFICIENT_DATA items in the pass/fail calculation
2. If >50% items have INSUFFICIENT_DATA, flag for more source material
3. Gate threshold is 60% - score = (passed / (passed + failed)) × 100%

Evaluate ONLY items applicable to ${mediaType}:
- CORE: All media
- GAME: Only for games
- VISUAL: Only for film/anime/series

Return as JSON:
{
  "evaluations": [
    {
      "id": "item_id",
      "status": "PASS" | "FAIL" | "INSUFFICIENT_DATA",
      "evidence": "direct quote or null",
      "functionalRole": "explanation or null"
    }
  ],
  "score": number,
  "gatePassed": true/false,
  "fixList": [
    {
      "id": "fix_id",
      "description": "what to fix",
      "severity": "critical" | "major" | "minor",
      "type": "motivation" | "competence" | "scale" | "resources" | "memory" | "ideology" | "time",
      "recommendedApproach": "conservative" | "compromise" | "radical"
    }
  ]
}`;
}

/**
 * Prompt for L2 (Body) evaluation
 */
export function getL2EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l1Score: number,
  checklist: string
): string {
  return `Evaluate L2 (Body) level - only if L1 passed (score: ${l1Score}%):

SKELETON:
${JSON.stringify(skeleton, null, 2)}

NARRATIVE:
"""
${narrative}
"""

L2 CHECKLIST:
${checklist}

L2 focuses on:
- Embodiment: fatigue, pain, smell, money in key scenes
- Character depth: hamartia, Mary Sue test, Price of Greatness
- Scene quality: body anchor, silence/slow time
- Narrative infrastructure: debt paid, misdirection

For each applicable item, evaluate with evidence:
- Status: PASS / FAIL / INSUFFICIENT_DATA
- Evidence: Direct quote from narrative
- Functional Role: How this serves the criterion functionally

Return as JSON with same structure as L1.`;
}

/**
 * Prompt for L3 (Psyche) evaluation
 */
export function getL3EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l2Score: number,
  griefMatrixContext: string
): string {
  return `Evaluate L3 (Psyche) level - only if L2 passed (score: ${l2Score}%):

SKELETON:
${JSON.stringify(skeleton, null, 2)}

NARRATIVE:
"""
${narrative}
"""

GRIEF ARCHITECTURE CONTEXT:
${griefMatrixContext}

L3 focuses on:
- Grief Architecture: All 5 stages materialized across 4 levels (Character, Location, Mechanic, Act)
- Dominant grief stage defined
- Character psychotypes: no duplicate stages among key characters

For grief architecture, map each stage to:
- Which character embodies it
- Which location embodies it
- Which mechanic/system embodies it
- Which narrative act embodies it

CRITICAL: Only require dominant stage fully filled. Other stages can be partial/absent.

Return as JSON:
{
  "evaluations": [...],
  "griefMatrix": {
    "dominantStage": "denial" | "anger" | "bargaining" | "depression" | "acceptance",
    "cells": [
      {
        "stage": "stage_name",
        "level": "character" | "location" | "mechanic" | "act",
        "character": "who/what embodies this",
        "evidence": "direct quote",
        "confidence": "high" | "medium" | "low" | "absent"
      }
    ]
  },
  "score": number,
  "gatePassed": true/false
}`;
}

/**
 * Prompt for L4 (Meta) evaluation
 */
export function getL4EvaluationPrompt(
  narrative: string,
  skeleton: Skeleton,
  l3Score: number
): string {
  return `Evaluate L4 (Meta) level - only if L3 passed (score: ${l3Score}%):

SKELETON:
${JSON.stringify(skeleton, null, 2)}

NARRATIVE:
"""
${narrative}
"""

L4 focuses on:
1. Three Layers of Reality (destruction test):
   - Personal layer: What agent wants, what they'd do without it
   - Plot layer: Why B follows A, what happens without causality
   - Meta-author layer: Question the finale asks the audience

2. Cornelian Dilemma:
   - Type: Value vs Value (not good vs evil)
   - Irreversibility: Choice physically changes world
   - Identity: "Who did you become?" not "what did you get?"
   - Price of victory: Victory = betraying one truth

3. Agent Mirror:
   - Does finale prompt self-question in audience?
   - Direct question to audience: "[Narrative] asks: are you capable of ___?"

4. Cult Potential (11 criteria):
   - Iceberg lore, resistance to understanding, interpretation provocation
   - Aesthetic uniqueness, playable antagonist, finale reinterprets beginning
   - Uncomfortable truth, logical expansion, memorable symbol
   - Theme relevance, unexplained depth enhances

Return as JSON:
{
  "evaluations": [...],
  "threeLayers": {
    "personal": { "stable": true/false, "proof": "..." },
    "plot": { "stable": true/false, "proof": "..." },
    "meta": { "stable": true/false, "proof": "..." }
  },
  "cornelianDilemma": {
    "valid": true/false,
    "valueA": "...",
    "valueB": "...",
    "irreversible": true/false,
    "thirdPath": "exists or not"
  },
  "agentMirror": {
    "integrated": true/false,
    "directQuestion": "..."
  },
  "cultPotential": {
    "score": number,
    "criteria": [true/false for each of 11]
  },
  "score": number,
  "gatePassed": true/false
}`;
}

/**
 * Prompt for full audit report generation
 */
export function getFullReportPrompt(
  narrative: string,
  mediaType: MediaType,
  auditMode: AuditMode,
  authorProfile: { type: string; percentage: number },
  skeleton: Skeleton,
  screeningResult: object,
  allGateResults: object,
  checklistResults: object,
  griefMatrix: object
): string {
  return `Generate complete audit report for this ${mediaType}:

AUDIT CONTEXT:
- Mode: ${auditMode}
- Author Profile: ${authorProfile.type} (${authorProfile.percentage}%)

SKELETON:
${JSON.stringify(skeleton, null, 2)}

SCREENING:
${JSON.stringify(screeningResult, null, 2)}

GATE RESULTS:
${JSON.stringify(allGateResults, null, 2)}

CHECKLIST:
${JSON.stringify(checklistResults, null, 2)}

GRIEF ARCHITECTURE:
${JSON.stringify(griefMatrix, null, 2)}

Generate TWO outputs:

=== PASS 1: HUMAN-READABLE REPORT ===

Generate a comprehensive markdown report with these 15 sections:

1. **Audit Mode** - Conflict/Kishō/Hybrid + justification
2. **Author Profile** - Gardener/Architect + % + main risks
3. **Extracted Skeleton** - Law, hamartia, trauma, pillars, engine, prohibition, question
4. **Quick Screening** - 7 YES/NO + depth flags
5. **Gate Results L1-L4** - % for each level
6. **Scores** - Connectedness/Vitality/Characters/Theme/Embodiment (0-5)
7. **Critical Holes** - Must-fix items with IDs
8. **Characters** - Hamartia/Mary Sue/anti-patterns/cult potential
9. **Grief Architecture** - Stages present/absent, dominant stage
10. **Finale and Dilemma** - Choice type, debt paid, agent mirror
11. **Patches** - Recommended approach via decision tree
12. **Cult Potential** - What works, what blocks
13. **Contrastive Analysis** - Compare to 2-3 references
14. **Final Score** - X/Y + % by level
15. **3 Priority Actions** - Do this now

=== PASS 2: JSON OUTPUT ===

Complete JSON with:
{
  "audit_meta": { "mode", "media_type", "applicable_items" },
  "author_profile": { "type", "percentage", "confidence" },
  "skeleton": { "thematic_law", "root_trauma", "hamartia", "dominant_grief_stage" },
  "gate_results": { L1_score, L1_passed, L2_score, L2_passed, L3_score, L3_passed, L4_score },
  "overall_score": { "checklist", "percentage", "classification" },
  "critical_issues": [{ id, level, severity, narrative_justification }],
  "priority_actions": [action1, action2, action3]
}`;
}

/**
 * Prompt for author profile determination
 */
export function getAuthorProfilePrompt(narrative: string): string {
  return `Determine author profile based on this narrative approach:

"""
${narrative}
"""

Answer these 7 questions about the author's working method (YES/NO):

1. When a character "must" do something stupid for the plot — does the author look for a way to make it organic?
2. Does the author know how characters behave in situations not described in the narrative?
3. Did plot twists emerge because characters arrived at them, not because the author planned them in advance? [KEY SIGNAL - weight 1.5]
4. Has the author ever been surprised by their own character's action?
5. Could the final scene have changed if one key character made a different decision at the midpoint? [KEY SIGNAL - weight 1.5]
6. Does the antagonist do the right things in the author's eyes — by their own logic?
7. Did the tragedy grow from the character's nature, not from plot necessity? [KEY SIGNAL - weight 1.5]

Classification:
- 80-100% YES → Gardener (organic chaos, logistics/scale holes)
- 50-70% YES → Hybrid (optimal for most narratives)
- 0-40% YES → Architect (characters serve plot, competence holes)

Return as JSON:
{
  "answers": { "Q1": true/false, ... "Q7": true/false },
  "weightedScore": number,
  "percentage": number,
  "type": "gardener" | "hybrid" | "architect",
  "confidence": "high" | "medium" | "low",
  "mainRisks": ["risk1", "risk2"],
  "auditPriorities": ["section1", "section2"]
}`;
}

/**
 * Combine prompts for multi-step analysis
 */
export function getCombinedAnalysisPrompt(
  narrative: string,
  mediaType: MediaType,
  options?: {
    skipScreening?: boolean;
    stopAtLevel?: 'L1' | 'L2' | 'L3';
  }
): string {
  const skipScreening = options?.skipScreening ?? false;
  const stopAt = options?.stopAtLevel;

  let prompt = `Perform complete Universe Audit Protocol v10.0 analysis.

NARRATIVE:
"""
${narrative}
"""

MEDIA TYPE: ${mediaType}

STEPS TO PERFORM:
1. Determine audit mode (conflict/kishō/hybrid)
2. Extract skeleton (8 structural elements)
${skipScreening ? '' : '3. Quick screening (7 questions)'}

Then for each level (STOP if gate fails):
4. L1 (Mechanism) - 60% threshold
${!stopAt || stopAt !== 'L1' ? '5. L2 (Body) - 60% threshold' : ''}
${!stopAt || stopAt !== 'L1' && stopAt !== 'L2' ? '6. L3 (Psyche) - 60% threshold' : ''}
${!stopAt ? '7. L4 (Meta)' : ''}

8. Generate full report (human-readable + JSON)

CRITICAL GATING RULE:
If any level scores <60%, STOP immediately and provide fix list.
Do NOT proceed to next level.

Return complete analysis.`;

  return prompt;
}
