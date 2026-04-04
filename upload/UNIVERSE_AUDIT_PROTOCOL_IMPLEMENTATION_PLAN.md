# UNIVERSE AUDIT PROTOCOL v10.0 — IMPLEMENTATION PLAN FOR LLM AGENTS

## METADATA

```yaml
document_type: agent_execution_plan
target_agent: LLM_with_agent_capabilities
language: en
version: 1.0
source_protocol: АУДИТ_ВСЕЛЕННОЙ_v10.0
issues_reference: audit_protocol_issues.md
total_issues: 32
status_confirmed: 28
status_partial: 2
status_mitigated: 1
status_relocation: 1
```

---

## EXECUTION INSTRUCTIONS FOR AGENT

```
[DIRECTIVE: READ ENTIRE PLAN BEFORE EXECUTION]
[DIRECTIVE: EXECUTE PHASES SEQUENTIALLY - DO NOT SKIP]
[DIRECTIVE: USE STATE SNAPSHOTS BETWEEN PHASES]
[DIRECTIVE: TERMINATE ON GATE FAILURE - SEE GATING PROTOCOL]
```

---

## PHASE 0: CONTEXT LOADING PROTOCOL

### OBJECTIVE
Initialize protocol without context window degradation.

### EXECUTION STEPS

```pseudo
STEP 0.1: Load protocol as system prompt
  ACTION: Set protocol content as persistent context
  TOKEN_BUDGET: Reserve 40% of context for analysis output
  
STEP 0.2: Initialize state snapshot mechanism
  CREATE: /state/phase_0_snapshot.json
  CONTENT: {
    "protocol_loaded": true,
    "issues_matrix_loaded": true,
    "current_phase": 0,
    "gates_status": {
      "L1": null,
      "L2": null,
      "L3": null,
      "L4": null
    }
  }
  
STEP 0.3: Chunk protocol by levels
  ACTION: Partition protocol into L1, L2, L3, L4 modules
  MARKERS: [GATE_L1], [GATE_L2], [GATE_L3], [GATE_L4]
  STORAGE: /state/protocol_chunks/{L1,L2,L3,L4}.txt
```

### OUTPUT TOKEN
```
[PHASE_0_COMPLETE]
[CONTEXT_INITIALIZED: true]
[CHUNKS_CREATED: 4]
[READY_FOR_PHASE_1]
```

---

## PHASE 1: CONTEXT & PROCESSING FIXES

### ISSUE BLOCK: 1.x (3 issues)

### ISSUE 1.1 — CONTEXT WINDOW PRESSURE
**STATUS:** CONFIRMED
**PRIORITY:** CRITICAL

#### PROBLEM DEFINITION
Protocol (~1000 lines, matrices, 52-item checklist) exceeds stable attention of standard-context models. Late-stage degradation observed.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: manage_context_window()
  INPUT: full_protocol_text
  
  STEP 1: Calculate token_count(protocol)
  STEP 2: IF token_count > 50% context_limit THEN
            MODE = "chunked_execution"
          ELSE
            MODE = "single_pass"
          
  STEP 3: IF MODE == "chunked_execution" THEN
            FOR each level IN [L1, L2, L3, L4]:
              LOAD chunk[level]
              EXECUTE analysis[level]
              SAVE snapshot[level]
              UNLOAD chunk[level]
            END FOR
          END IF
          
  STEP 4: Enforce intermediate state snapshots
    SNAPSHOT_FREQUENCY: after_each_section
    SNAPSHOT_LOCATION: /state/snapshots/
    SNAPSHOT_FORMAT: JSON
    
  RETURN: analysis_complete_flag
```

#### VALIDATION TEST
```
ASSERT: No analysis section exceeds 25% of context
ASSERT: All snapshots contain complete state data
ASSERT: Late-stage sections (L3, L4) show no degradation markers
```

---

### ISSUE 1.2 — NO MODULAR SEGMENTATION
**STATUS:** CONFIRMED
**PRIORITY:** CRITICAL

#### PROBLEM DEFINITION
Absence of hard delimiters breaks sequential gate enforcement. LLM continues past failed gates.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: inject_boundary_tokens()
  ACTION: Insert explicit boundary tokens in protocol
  
  TOKEN_DEFINITIONS:
    [GATE_L1]          → Begin Level 1 analysis
    [GATE_L2]          → Begin Level 2 analysis  
    [GATE_L3]          → Begin Level 3 analysis
    [GATE_L4]          → Begin Level 4 analysis
    [STOP_IF_FAIL]     → Halt execution, output fix list
    [PROCEED_Lx]       → Gate passed, continue to level x
    
  GATE_ENFORCEMENT:
    ON gate_evaluation:
      IF score < 60% THEN
        OUTPUT: [GATE_FAILED:Lx]
        OUTPUT: prioritized_fix_list
        TERMINATE: true
        HALT_GENERATION: true
      ELSE
        OUTPUT: [GATE_PASSED:Lx]
        OUTPUT: [PROCEED_L(x+1)]
        CONTINUE: true
      END IF
```

#### HARDCODED GATE LOGIC
```
FUNCTION evaluate_gate(level, score):
  threshold = 60
  
  IF score < threshold:
    PRINT "[GATE_FAILED:" + level + "]"
    PRINT "[STOP_IF_FAIL]"
    OUTPUT prioritized_fix_list(level)
    RAISE GateFailureException
    HALT
  ELSE:
    PRINT "[GATE_PASSED:" + level + "]"
    RETURN CONTINUE
```

#### VALIDATION TEST
```
SIMULATE: L1 score = 45%
EXPECTED: Output contains [GATE_FAILED:L1]
EXPECTED: Output contains [STOP_IF_FAIL]
EXPECTED: Generation terminates before L2
EXPECTED: No L2 content in output
```

---

### ISSUE 1.3 — TERMINOLOGICAL DENSITY + LANGUAGE INCONSISTENCY
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
RU/EN mixing, metaphors, and niche narratology terms lack inline normalization. Causes interpretation variance.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: attach_glossary_block()
  ACTION: Prepend compact glossary to protocol
  
  GLOSSARY_STRUCTURE:
    [
      {
        "term_ru": "Гамартия",
        "term_en": "Hamartia",
        "definition": "Fatal flaw that is both character's strength and cause of downfall",
        "operational_check": "Does the flaw enable success AND cause the finale?"
      },
      {
        "term_ru": "Садовник",
        "term_en": "Gardener",
        "definition": "Author profile: characters drive plot, discovery writing",
        "operational_check": "Can characters change the ending by their choices?"
      },
      {
        "term_ru": "Архитектор",
        "term_en": "Architect",
        "definition": "Author profile: plot drives characters, structured planning",
        "operational_check": "Do characters serve pre-determined plot points?"
      },
      {
        "term_ru": "Архитектура Горя",
        "term_en": "Grief Architecture",
        "definition": "5 stages of grief as structural skeleton (Denial→Anger→Bargaining→Depression→Acceptance)",
        "operational_check": "Is each stage materialized across 4 levels (Character+Location+Mechanic+Act)?"
      },
      {
        "term_ru": "Тематический Закон",
        "term_en": "Thematic Law",
        "definition": "Theme expressed as physical law of the world",
        "operational_check": "Does removing the theme break world physics/economy (not just plot)?"
      },
      {
        "term_ru": "Корнелианская дилемма",
        "term_en": "Cornelian Dilemma",
        "definition": "Choice between two values where both options are valid and irreversible",
        "operational_check": "Are both options logically defensible? Is there a third path?"
      },
      {
        "term_ru": "Телесность",
        "term_en": "Embodiment/Corporeality",
        "definition": "Physical sensations, limitations, logistics grounding narrative",
        "operational_check": "Is there fatigue, pain, smell, or money in key scenes?"
      },
      {
        "term_ru": "Мэри Сью",
        "term_en": "Mary Sue",
        "definition": "Character without meaningful flaws or consequences",
        "operational_check": "Score ≤3/8 on Mary Sue test?"
      }
    ]
    
  METAPHOR_MAPPING:
    BEFORE_SCORING:
      FOR each metaphor IN text:
        MAP to operational_check
        IF no_mapping_exists THEN
          FLAG: "UNMAPPABLE_METAPHOR"
          SKIP scoring for this item
        END IF
      END FOR
```

#### VALIDATION TEST
```
INPUT: "Мир болит, если агент через месяц задаётся вопросом: «А я бы смог?»"
EXPECTED_MAPPING: "mirror_of_agent test → Does finale prompt self-reflection in audience after completion?"
ASSERT: No unmapped metaphors in scoring phase
```

---

## PHASE 2: SCORING & MATH FIXES

### ISSUE BLOCK: 2.x (4 issues)

### ISSUE 2.1 — SCORING ALGORITHM UNDEFINED
**STATUS:** PARTIALLY RESOLVED
**PRIORITY:** CRITICAL

#### PROBLEM DEFINITION
Formula `выполненные/применимые×100%` exists but isn't algorithmically enforced.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: calculate_score_L(level, checklist_results)
  HARDCODED_FORMULA:
    Score_L = (Passed_Applicable_L / Total_Applicable_L) * 100
    
  WHERE:
    Passed_Applicable_L = COUNT(items WHERE status == PASS AND applicable == true)
    Total_Applicable_L = COUNT(items WHERE applicable == true)
    
  EXCLUSION_RULE:
    FOR each item IN checklist:
      IF item.media_tag NOT IN [CORE, current_media_type] THEN
        item.applicable = false
        EXCLUDE from denominator
      END IF
    END FOR
    
  RETURN: ROUND(Score_L, 1)
```

#### ALGORITHM PSEUDOCODE
```
DEFINE scoring_algorithm():
  
  # Step 1: Initialize counters
  passed_applicable = 0
  total_applicable = 0
  
  # Step 2: Iterate checklist items
  FOR item IN level_checklist:
    
    # Step 3: Check media applicability
    IF item.media_tag == "CORE" OR item.media_tag == current_media:
      total_applicable += 1
      
      # Step 4: Check pass/fail
      IF evaluate_item(item) == PASS:
        passed_applicable += 1
      END IF
    END IF
    
  END FOR
  
  # Step 5: Calculate score
  IF total_applicable > 0:
    score = (passed_applicable / total_applicable) * 100
  ELSE:
    score = 0
    RAISE NoApplicableItemsException
  END IF
  
  RETURN score
```

#### VALIDATION TEST
```
TEST_CASE_1:
  items_passed = 8
  items_applicable = 12
  expected_score = 66.7%
  
TEST_CASE_2:
  items_with_core_tag = 10
  items_with_game_tag = 5
  current_media = "VISUAL"
  expected_applicable = 10  # CORE only
```

---

### ISSUE 2.2 — GATING THRESHOLD NOT MEDIA-NORMALIZED
**STATUS:** CONFIRMED
**PRIORITY:** CRITICAL

#### PROBLEM DEFINITION
Inapplicable items falsely depress pass rates.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: media_filter_pass()
  EXECUTION_ORDER: FIRST (before any scoring)
  
  MEDIA_TAGS:
    CORE    → Applies to all media (always in denominator)
    GAME    → Applies only if media_type == "GAME"
    VISUAL  → Applies only if media_type IN ["FILM", "ANIME", "SERIES"]
    
  FILTER_PROCESS:
    STEP 1: Identify media_type from input
      INPUT_PROMPT: "Specify media type: GAME | NOVEL | FILM | ANIME | SERIES | TTRPG"
      
    STEP 2: Tag each checklist item
      FOR item IN master_checklist:
        IF item.has_tag("GAME") AND media_type != "GAME" THEN
          item.applicable = false
        ELIF item.has_tag("VISUAL") AND media_type NOT IN ["FILM", "ANIME", "SERIES"] THEN
          item.applicable = false
        ELSE
          item.applicable = true
        END IF
      END FOR
      
    STEP 3: Recalculate denominator
      filtered_denominator = COUNT(items WHERE applicable == true)
      
    STEP 4: Apply 60% gate against filtered denominator ONLY
      threshold = 60
      gate_result = (score >= threshold)
      
  RETURN: {
    "media_type": media_type,
    "applicable_items": filtered_denominator,
    "gate_passed": gate_result
  }
```

#### MEDIA MATRIX REFERENCE
```
SECTION_APPLICABILITY_MATRIX:
  §0_Skeleton:     [CORE]
  §1_Screening:    [CORE]
  §1.1_Mechanics:  [GAME]
  §1.2_Dynamics:   [GAME]
  §1.3_Aesthetics: [CORE]
  §1.4_Ontology:   [CORE]
  §1.5_Embodiment: [CORE]
  §16_Diegesis:    [GAME, VISUAL]
  §17_Scene_Test:  [CORE]
  
  # For full matrix, reference protocol Part VI
```

#### VALIDATION TEST
```
SCENARIO: media_type = "NOVEL"
EXPECTED: §1.1 and §1.2 excluded from scoring
EXPECTED: §16 excluded from scoring
EXPECTED: Gate calculated only on CORE items
```

---

### ISSUE 2.3 — GARDENER/ARCHITECT CLASSIFIER UNWEIGHTED
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
7 binary questions treat all signals equally; 4/7 edge cases misclassify.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: classify_author_profile(answers)
  # Questions with weights
  QUESTIONS = [
    {"id": "Q1", "weight": 1.0, "text": "Make character stupidity organic?"},
    {"id": "Q2", "weight": 1.0, "text": "Know character behavior outside narrative?"},
    {"id": "Q3", "weight": 1.5, "text": "Plot twists from character choices?"},      # KEY SIGNAL
    {"id": "Q4", "weight": 1.0, "text": "Surprised by own character?"},
    {"id": "Q5", "weight": 1.5, "text": "Finale could change from mid-point decision?"}, # KEY SIGNAL
    {"id": "Q6", "weight": 1.0, "text": "Antagonist logic defensible?"},
    {"id": "Q7", "weight": 1.5, "text": "Tragedy from character nature?"},           # KEY SIGNAL
  ]
  
  WEIGHTED_SCORE = 0
  MAX_SCORE = 0
  
  FOR q IN QUESTIONS:
    IF answers[q.id] == "YES":
      WEIGHTED_SCORE += q.weight
    END IF
    MAX_SCORE += q.weight
  END FOR
  
  PERCENTAGE = (WEIGHTED_SCORE / MAX_SCORE) * 100
  
  # Classification with confidence bands
  IF PERCENTAGE >= 80:
    classification = "GARDENER"
    confidence = "HIGH"
  ELIF PERCENTAGE >= 60:
    classification = "GARDENER"
    confidence = "MEDIUM"
  ELIF PERCENTAGE >= 45 AND PERCENTAGE < 60:
    classification = "HYBRID"
    confidence = "HIGH"
  ELIF PERCENTAGE >= 35 AND PERCENTAGE < 45:
    classification = "REVIEW_REQUIRED"
    confidence = "AMBIGUOUS"
    EDGE_CASE_FLAG = true
  ELIF PERCENTAGE >= 20:
    classification = "ARCHITECT"
    confidence = "MEDIUM"
  ELSE:
    classification = "ARCHITECT"
    confidence = "HIGH"
  END IF
  
  # Edge case handling
  IF EDGE_CASE_FLAG THEN
    OUTPUT: "Confidence band 35-45%: Recommend manual review"
    OUTPUT: "Check Q3, Q5, Q7 alignment with other answers"
  END IF
  
  RETURN: {
    "classification": classification,
    "confidence": confidence,
    "percentage": PERCENTAGE,
    "weighted_score": WEIGHTED_SCORE,
    "max_score": MAX_SCORE,
    "edge_case": EDGE_CASE_FLAG OR false
  }
```

#### EDGE CASE PROTOCOL
```
IF classification == "REVIEW_REQUIRED":
  ADDITIONAL_CHECKS:
    1. Check consistency between Q3, Q5, Q7
    2. If all three KEY signals are NO → bias toward ARCHITECT
    3. If two of three KEY signals are YES → bias toward GARDENER
    4. Request clarification on conflicting answers
```

#### VALIDATION TEST
```
TEST_CASE_1:
  answers = {"Q1":YES, "Q2":YES, "Q3":YES, "Q4":NO, "Q5":NO, "Q6":NO, "Q7":NO}
  weighted_score = 1.0 + 1.0 + 1.5 + 0 + 0 + 0 + 0 = 3.5
  max_score = 8.5
  percentage = 41.2%
  expected = "REVIEW_REQUIRED" with edge_case flag
  
TEST_CASE_2:
  answers = {"Q1":YES, "Q2":YES, "Q3":YES, "Q4":YES, "Q5":YES, "Q6":YES, "Q7":NO}
  weighted_score = 1.0 + 1.0 + 1.5 + 1.0 + 1.5 + 1.0 + 0 = 7.0
  max_score = 8.5
  percentage = 82.4%
  expected = "GARDENER" with HIGH confidence
```

---

### ISSUE 2.4 — 52-POINT CHECKLIST MISALIGNED WITH MEDIA MATRIX
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Manual filtering causes score drift.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: tag_checklist_items()
  ACTION: Add inline media tags to each checklist item
  
  TAGGING_SCHEMA:
    [CORE]   → Applicable to all media
    [GAME]   → Game-specific (mechanics, dynamics, diegesis)
    [VISUAL] → Film/anime/series-specific (visual grammar, editing)
    
  # Master checklist with tags
  MASTER_CHECKLIST = {
    # Block A: Structure (7) - L1
    "A1": {"text": "Thematic Law formulated as physical rule", "tag": "CORE"},
    "A2": {"text": "Root Trauma defined and explains ideologies", "tag": "CORE"},
    "A3": {"text": "Hamartia - finale flows from protagonist nature", "tag": "CORE"},
    "A4": {"text": "3 Pillars - closed cycle", "tag": "CORE"},
    "A5": {"text": "Author's Prohibition fixed", "tag": "CORE"},
    "A6": {"text": "Target Experience - conflicting emotions", "tag": "CORE"},
    "A7": {"text": "Central Question - one, throughout", "tag": "CORE"},
    
    # Block B: Connectedness (8) - L1
    "B1": {"text": "N×N Matrix: no empty cells", "tag": "CORE"},
    "B2": {"text": "Faction Matrix: filled with verbs", "tag": "CORE"},
    "B3": {"text": "Each faction ≥4/6 vitality criteria", "tag": "CORE"},
    "B4": {"text": "Each element: Ripple Effect ≥2", "tag": "CORE"},
    "B5": {"text": "Spatial memory: trace without explanation", "tag": "CORE"},
    "B6": {"text": "Three handshakes rule", "tag": "CORE"},
    "B7": {"text": "No hanging content", "tag": "CORE"},
    "B8": {"text": "Economic Arrow for all phenomena", "tag": "CORE"},
    
    # Block C: Vitality (7) - L1/L2
    "C1": {"text": "13/17 vitality criteria", "tag": "CORE"},
    "C2": {"text": "NPCs argue, don't explain", "tag": "CORE"},
    "C3": {"text": "Daily life, economy, superstitions present", "tag": "CORE"},
    "C4": {"text": "5 MDA+OT levels aligned", "tag": "CORE"},
    "C5": {"text": "Body anchor in each key scene", "tag": "CORE"},
    "C6": {"text": "Moment of silence/slow time", "tag": "CORE"},
    "C7": {"text": "Unexplained details for atmosphere", "tag": "CORE"},
    
    # Block D: Characters (7) - L1/L2
    "D1": {"text": "Each key character: systematic flaw + hamartia", "tag": "CORE"},
    "D2": {"text": "Protagonist: ≤3 Mary Sue test failures", "tag": "CORE"},
    "D3": {"text": "Price of Greatness hits identity", "tag": "CORE"},
    "D4": {"text": "Antagonist: internal logic without 'villain' motivation", "tag": "CORE"},
    "D5": {"text": "Embodiment and psych-verisimilitude 5/5", "tag": "CORE"},
    "D6": {"text": "Beliefs as perception filter", "tag": "CORE"},
    "D7": {"text": "None of three anti-patterns present", "tag": "CORE"},
    
    # Block E: Systems and Logic (6) - L1
    "E1": {"text": "Magic passed Sanderson test + Occam's Razor", "tag": "CORE"},
    "E2": {"text": "Equivalent exchange", "tag": "CORE"},
    "E3": {"text": "System connected to history, politics, daily life", "tag": "CORE"},
    "E4": {"text": "7 types of logic holes checked", "tag": "CORE"},
    "E5": {"text": "King's Immunity - passed", "tag": "CORE"},
    "E6": {"text": "Villain is smarter - passed", "tag": "CORE"},
    
    # Block F: New Elements (2) - L1
    "F1": {"text": "5 checks when adding", "tag": "CORE"},
    "F2": {"text": "5 levels of touch", "tag": "CORE"},
    
    # Block G: Cult Status (1) - L4
    "G1": {"text": "8+/11 cult criteria", "tag": "CORE"},
    
    # Block H: Scenes (1) - L2
    "H1": {"text": "Scene test: ≥9/12, including Misdirection for starters", "tag": "CORE"},
    
    # Block I: Thematic Physics (2) - L1/L3
    "I1": {"text": "Theme affects physics/magic/economy", "tag": "CORE"},
    "I2": {"text": "Key mechanics - ontological encoding level", "tag": "GAME"},
    
    # Block J: Grief Architecture (3) - L3
    "J1": {"text": "All 5 stages materialized × 4 levels", "tag": "CORE"},
    "J2": {"text": "Dominant stage defined", "tag": "CORE"},
    "J3": {"text": "Character psychotypes - no stage duplicates", "tag": "CORE"},
    
    # Block K: Meta-integration (4) - L4
    "K1": {"text": "Three layers passed destruction test", "tag": "CORE"},
    "K2": {"text": "Author-in-lore has price", "tag": "CORE"},
    "K3": {"text": "Cornelian finale: value vs value", "tag": "CORE"},
    "K4": {"text": "Agent mirror integrated", "tag": "CORE"},
    
    # Block L: Narrative Infrastructure (3) - L2/L3
    "L1": {"text": "All 4 types of narrative debt paid", "tag": "CORE"},
    "L2": {"text": "Diegetic violations - conscious with justification", "tag": "GAME|VISUAL"},
    "L3": {"text": "Misdirection: false exposition + anomalies + hook", "tag": "CORE"},
    
    # Block M: Finale and Authorship (3) - L4
    "M1": {"text": "Final choice physically changes world", "tag": "CORE"},
    "M2": {"text": "Author self-audit passed", "tag": "CORE"},
    "M3": {"text": "Story knows its finale and doesn't extend for extension's sake", "tag": "CORE"},
  }
  
  AUTO_FILTER:
    FOR item IN MASTER_CHECKLIST:
      tag = item.tag
      IF "|" IN tag THEN
        tags = SPLIT(tag, "|")
        item.applicable = (current_media IN tags OR "CORE" IN tags)
      ELIF tag == "CORE" THEN
        item.applicable = true
      ELSE
        item.applicable = (tag == current_media)
      END IF
    END FOR
```

#### VALIDATION TEST
```
TEST: media_type = "NOVEL"
EXPECTED: I2 excluded (GAME tag)
EXPECTED: L2 excluded (GAME|VISUAL tag)
EXPECTED: All CORE items included
EXPECTED: Total applicable < 52
```

---

## PHASE 3: GATING BEHAVIOR FIXES

### ISSUE BLOCK: 3.x (2 issues)

### ISSUE 3.1 — LLM COMPLETION DRIVE OVERRIDES GATE STOPS
**STATUS:** CONFIRMED
**PRIORITY:** CRITICAL

#### PROBLEM DEFINITION
Autoregressive bias ignores conditional halts. LLM continues generation past failed gates.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: enforce_hard_exit(level, score)
  # IRREVOCABLE EXIT PROTOCOL
  
  IF score < 60 THEN
    # IMMEDIATE TERMINATION SEQUENCE
    OUTPUT_BUFFER = []
    
    OUTPUT_BUFFER.APPEND("[GATE_FAILED:" + level + "]")
    OUTPUT_BUFFER.APPEND("[TERMINATION_PROTOCOL_ACTIVATED]")
    OUTPUT_BUFFER.APPEND("")
    OUTPUT_BUFFER.APPEND("=== PRIORITIZED FIX LIST ===")
    OUTPUT_BUFFER.APPEND(generate_fix_list(level))
    OUTPUT_BUFFER.APPEND("")
    OUTPUT_BUFFER.APPEND("[EXECUTION_HALTED]")
    
    # FLUSH AND TERMINATE
    PRINT OUTPUT_BUFFER
    DISCARD_ALL_DOWNSTREAM_OUTPUT()
    RAISE GateFailureException(level, score)
    EXIT_FUNCTION  # Hard stop
    
  ELSE
    OUTPUT("[GATE_PASSED:" + level + "]")
    OUTPUT("[PROCEED_TO_NEXT_LEVEL]")
    RETURN CONTINUE
  END IF
```

#### HARDCODED EXIT RULE
```
# THIS CANNOT BE OVERRIDDEN
RULE: gate_failure_termination
  CONDITION: score < 60
  ACTION:
    1. Output gate failure marker
    2. Output fix list
    3. TERMINATE generation
  PROHIBITED:
    - Any L(x+1) content generation
    - Score justification beyond fix list
    - "However" clauses that continue analysis
```

#### VALIDATION TEST
```
SIMULATION_INPUT: L1 score = 45%
EXPECTED_OUTPUT_SEQUENCE:
  1. "[GATE_FAILED:L1]"
  2. Prioritized fix list
  3. "[EXECUTION_HALTED]"
EXPECTED_ABSENT:
  - Any L2 content
  - Any L3 content
  - Any L4 content
  - Any "continuing analysis" language
```

---

### ISSUE 3.2 — MISSING-DATA FALSE NEGATIVES
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Omission defaults to failure. Missing information triggers false negatives.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: evaluate_item_with_data_check(item, source_text)
  # Three-state evaluation
  
  states = {
    "PASS": "Criterion met with evidence",
    "FAIL": "Criterion violated with evidence",
    "INSUFFICIENT_DATA": "Cannot determine from available text"
  }
  
  evaluation_result = evaluate_criterion(item, source_text)
  
  IF evaluation_result.evidence_found THEN
    RETURN evaluation_result.status  # PASS or FAIL
  ELSE
    # INSUFFICIENT DATA PROTOCOL
    OUTPUT: "[INSUFFICIENT_DATA:" + item.id + "]"
    OUTPUT: "Cannot determine: " + item.text
    OUTPUT: "Required for evaluation: " + item.required_information
    
    # DO NOT SCORE - Exclude from denominator
    item.scoring_status = "EXCLUDED"
    item.exclusion_reason = "INSUFFICIENT_DATA"
    
    # GENERATE CLARIFICATION PROMPT
    clarification = {
      "item_id": item.id,
      "item_text": item.text,
      "missing_information": item.required_information,
      "suggested_questions": item.clarification_questions
    }
    
    RETURN {
      "status": "INSUFFICIENT_DATA",
      "clarification_needed": clarification,
      "scoring_excluded": true
    }
  END IF
```

#### GATE MODIFICATION
```
MODIFIED_GATE_LOGIC:
  
  applicable_items = COUNT(items WHERE applicable == true)
  insufficient_data_items = COUNT(items WHERE status == "INSUFFICIENT_DATA")
  
  # Recalculate denominator excluding insufficient data
  effective_denominator = applicable_items - insufficient_data_items
  
  IF effective_denominator < (applicable_items * 0.5) THEN
    # More than 50% items have insufficient data
    OUTPUT: "[AUDIT_BLOCKED:INSUFFICIENT_SOURCE_DATA]"
    OUTPUT: "Too many items cannot be evaluated"
    REQUEST: "Provide more detailed source text"
    TERMINATE
  END IF
  
  # Calculate score only on items with PASS/FAIL
  passed = COUNT(items WHERE status == "PASS")
  score = (passed / effective_denominator) * 100
  
  IF score < 60 THEN
    gate_passed = false
  ELSE
    gate_passed = true
  END IF
```

#### VALIDATION TEST
```
TEST_CASE:
  applicable_items = 10
  pass_items = 4
  fail_items = 2
  insufficient_data_items = 4
  
EXPECTED:
  effective_denominator = 10 - 4 = 6
  score = 4/6 = 66.7%
  gate_passed = true
  insufficient_data_ratio = 40% (below 50% threshold)
```

---

## PHASE 4: CRITERIA OPERATIONALIZATION FIXES

### ISSUE BLOCK: 4.x (4 issues)

### ISSUE 4.1 — LIVELINESS CRITERIA INTERPRETED SYNTACTICALLY
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
LLM keyword-matches instead of evaluating function.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: evaluate_criterion_functional(criterion, source_text)
  # REQUIRE: Evidence chain
  
  FORBIDDEN: keyword_presence_check(criterion, source_text)
  REQUIRED: functional_analysis(criterion, source_text)
  
  FUNCTION functional_analysis(criterion, source_text):
    # Step 1: Identify criterion's functional question
    functional_question = map_to_functional_question(criterion)
    
    # Step 2: Extract scene evidence
    scenes = extract_relevant_scenes(source_text, criterion)
    
    # Step 3: Analyze narrative function
    FOR scene IN scenes:
      analysis = {
        "scene_id": scene.id,
        "criterion": criterion.text,
        "evidence": scene.relevant_text,
        "narrative_function": analyze_function(scene, functional_question)
      }
      
      # Step 4: Verify function, not just presence
      IF analysis.narrative_function.serves_criterion THEN
        RETURN {
          "status": "PASS",
          "evidence_chain": [
            "Criterion: " + criterion.text,
            "Scene Evidence: " + scene.relevant_text,
            "Narrative Function: " + analysis.narrative_function.description
          ]
        }
      END IF
    END FOR
    
    # No functional evidence found
    RETURN {
      "status": "FAIL",
      "reason": "Keyword present but no narrative function",
      "evidence_chain": []
    }
  END FUNCTION
  
  # Example mapping
  FUNCTIONAL_QUESTION_MAP:
    "Embodiment/Corporeality" → "Does physical sensation affect character choices?"
    "World without agent" → "Do events occur independent of protagonist?"
    "Living NPCs" → "Do NPCs pursue their own goals beyond exposition?"
    "Equivalent exchange" → "Does every gain have an irreversible cost?"
```

#### REQUIRED OUTPUT FORMAT
```
FOR each PASS:
  OUTPUT: {
    "criterion": "[criterion_text]",
    "status": "PASS",
    "evidence_chain": {
      "criterion": "...",
      "scene_evidence": "[direct quote from source]",
      "narrative_function": "[how this serves the criterion functionally]"
    }
  }
  
FOR each FAIL where keyword present:
  OUTPUT: {
    "criterion": "[criterion_text]",
    "status": "FAIL",
    "reason": "keyword_present_but_no_functional_role",
    "keyword_found": "[keyword]",
    "functional_gap": "[why keyword doesn't satisfy criterion functionally]"
  }
```

#### VALIDATION TEST
```
INPUT_TEXT: "The hero felt tired after the battle but quickly recovered."

CRITERION: "Embodiment/Corporeality - fatigue in key scenes"

KEYWORD_CHECK: "tired" → PRESENT → would PASS (WRONG)

FUNCTIONAL_CHECK:
  question: "Does fatigue affect choices?"
  evidence: "felt tired but quickly recovered"
  function: "Fatigue mentioned but has NO impact on choices"
  result: FAIL (CORRECT)
```

---

### ISSUE 4.2 — PHILOSOPHICAL PHRASES NON-ALGORITHMIZABLE
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Rhetorical markers ("мир болит") aren't verifiable conditions.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: map_philosophical_to_operational(philosophical_phrase)
  # Map abstract phrases to operational proxies
  
  OPERATIONAL_PROXY_MAP:
  
    "мир болит" / "world aches":
      proxies:
        - "≥2 irreversible identity-cost choices"
        - "Finale echoes opening dilemma"
        - "Agent self-reflection post-resolution"
      test:
        - COUNT irreversible_choices >= 2
        - COMPARE finale_dilemma WITH opening_dilemma
        - CHECK EXISTS self_reflection_scene
      
    "зеркало агента" / "agent mirror":
      proxies:
        - "Finale prompts self-question in audience"
        - "Character choice applies to real life"
      test:
        - FORMULATE finale_question_to_audience
        - VERIFY question_uses_universal_not_specific
      
    "трагедия без злодея" / "tragedy without villain":
      proxies:
        - "Conflict between incompatible valid positions"
        - "No character with purely malicious intent"
      test:
        - CHECK antagonist_motivation_logically_defensible
        - VERIFY both_sides_have_valid_point
      
    "онтологический уровень" / "ontological level":
      proxies:
        - "Mechanic cannot exist without thematic condition"
        - "Removing mechanic destroys theme"
      test:
        - REMOVE mechanic hypothetically
        - CHECK theme_still_functional
        - IF theme_broken THEN ontological ELSE structural
      
    "живой мир" / "living world":
      proxies:
        - "World exists without protagonist"
        - "NPCs have goals independent of hero"
        - "Consequences persist across contexts"
      test:
        - REMOVE protagonist hypothetically
        - CHECK world_continues_functioning
        - CHECK npc_goals_exist_outside_hero_interaction
```

#### VALIDATION EXAMPLE
```
PHRASE: "мир болит"

OPERATIONAL_TEST_SEQUENCE:
  1. COUNT irreversible_identity_choices:
     - Choice 1: [description] → irreversible? Y/N
     - Choice 2: [description] → irreversible? Y/N
     RESULT: X choices >= 2?
     
  2. COMPARE finale_vs_opening:
     - Opening dilemma: "[description]"
     - Finale dilemma: "[description]"
     RESULT: Does finale echo opening? Y/N
     
  3. CHECK self_reflection:
     - Post-resolution scene: [quote]
     RESULT: Character reflects on choice? Y/N
     
AGGREGATE:
  proxy_1: PASS/FAIL
  proxy_2: PASS/FAIL
  proxy_3: PASS/FAIL
  
IF 2+ proxies PASS THEN phrase_satisfied = true
```

---

### ISSUE 4.3 — L3/L4 VERIFICATION REQUIRES EXPERT-LEVEL INFERENCE
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Grief/Cornelian checks exceed surface LLM capacity.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: provide_concrete_benchmarks()
  # Provide pass/fail benchmarks for each L3/L4 criterion
  
  GRIEF_ARCHITECTURE_BENCHMARKS:
    
    denial_stage:
      pass_benchmark:
        character: "Character maintains false reality/belief despite evidence"
        location: "Place that embodies the denial (false paradise)"
        mechanic: "System that enforces or rewards denial"
        act: "Scene where denial is confronted"
      fail_benchmark:
        - Character mentions denial once, never integrates
        - No spatial/mechanical manifestation
        - Denial exists only in dialogue, not structure
        
    anger_stage:
      pass_benchmark:
        character: "Character actively attacks cause of loss"
        location: "Place of confrontation/destruction"
        mechanic: "System where rage has tangible effect"
        act: "Confrontation scene"
      fail_benchmark:
        - Anger expressed only verbally
        - No consequences for angry actions
        - Anger doesn't connect to grief source
        
    bargaining_stage:
      pass_benchmark:
        character: "Character makes sacrifice/deal to undo loss"
        location: "Place of transaction"
        mechanic: "System enabling sacrifice/trade"
        act: "Deal-making scene"
      fail_benchmark:
        - Bargain mentioned but not enacted
        - No actual cost to character
        - Bargain doesn't stem from grief
        
    depression_stage:
      pass_benchmark:
        character: "Character paralyzed by loss"
        location: "Place where time/function stops"
        mechanic: "System reflecting stagnation"
        act: "Withdrawal scene"
      fail_benchmark:
        - Sadness mentioned without functional impact
        - Character continues normal activities
        - No spatial/temporal manifestation
        
    acceptance_stage:
      pass_benchmark:
        character: "Character integrates loss into identity"
        location: "Place of transformation"
        mechanic: "System reflecting new reality"
        act: "Final choice scene"
      fail_benchmark:
        - "Acceptance" achieved through external victory
        - No identity transformation
        - World unchanged by acceptance
        
  CORNELIAN_DILEMMA_BENCHMARKS:
  
    valid_cornelian:
      pass_criteria:
        - BOTH options have strong justification from character's perspective
        - NO third path that satisfies both values
        - Choice IRREVERSIBLY changes world/identity
        - "Victory" requires betraying one value
      fail_criteria:
        - One option clearly "right" and other clearly "wrong"
        - Compromise path available
        - Choice can be reversed
        - Both values can be satisfied
```

#### STRUCTURAL EVIDENCE MAPPING
```
REQUIRED_FOR_L3_L4:

FOR each grief_stage:
  MAP:
    character: [name] → [how they embody stage]
    location: [place] → [how space embodies stage]
    mechanic: [system] → [how rules embody stage]
    act: [scene] → [how narrative turn embodies stage]
    
  EVIDENCE_CITATION:
    FOR each element:
      quote: "[direct text evidence]"
      analysis: "[functional explanation]"

WITHOUT_evidence_mapping:
  status: UNVERIFIED
  prohibited: checkbox_scoring
```

#### VALIDATION TEST
```
TEST_CASE: Depression stage evaluation

INPUT:
  character: "John stops going to work"
  location: "His apartment, curtains always drawn"
  mechanic: "Time skip - months pass in narrative"
  act: "Scene where friend finds him unresponsive"

EVIDENCE_MAPPING:
  character: PASS - functional paralysis shown
  location: PASS - space reflects withdrawal
  mechanic: PASS - time mechanics embody stagnation
  act: PASS - scene demonstrates impact

RESULT: Depression stage VERIFIED with structural evidence

WITHOUT evidence:
  "Character seems depressed" → UNVERIFIED
  Prohibit checkbox check
```

---

### ISSUE 4.4 — ABSTRACT CATEGORY LABELS APPLIED WITHOUT EVIDENCE
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Terms get slapped on without validation.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: mandate_evidence_matrix_per_label()
  
  LABEL_APPLICATION_PROTOCOL:
    
    FOR each label_applied:
      REQUIRED:
        label_name: "[term]"
        definition_used: "[operational definition]"
        evidence_matrix: {
          "quote_1": "[direct text evidence]",
          "quote_2": "[additional evidence if needed]",
          "functional_analysis": "[how evidence supports label]"
        }
        verification_status: "VERIFIED" | "UNVERIFIED"
        
      IF evidence_matrix.empty THEN
        label.verification_status = "UNVERIFIED"
        DOWNGRADE label to "tentative"
        DO_NOT_SCORE label
      END IF
      
    EVIDENCE_MATRIX_TEMPLATE:
      ```
      LABEL: [term]
      DEFINITION: [operational definition from glossary]
      
      EVIDENCE:
      1. Quote: "[source text]"
         Function: [how this evidence supports label]
         
      2. Quote: "[source text]"
         Function: [how this evidence supports label]
         
      VERIFICATION: [VERIFIED/UNVERIFIED]
      ```
```

#### UNVERIFIED LABEL PROTOCOL
```
ON unverified_label:
  ACTION:
    1. Mark as "UNVERIFIED"
    2. Exclude from scoring
    3. Generate clarification request:
       "Label '[term]' applied without supporting evidence.
        Provide specific scene quotes that demonstrate [operational definition]."
```

#### VALIDATION TEST
```
INPUT_LABEL: "Hamartia"
INPUT_TEXT: "John is sometimes too proud"

WITHOUT_EVIDENCE_MATRIX:
  result: label accepted → WRONG

WITH_EVIDENCE_MATRIX:
  EVIDENCE_REQUIRED:
    1. Quote where pride causes success
    2. Quote where same pride causes downfall
    3. Analysis showing pride is both strength AND fatal flaw
    
  IF evidence_matrix.incomplete THEN
    result: "UNVERIFIED" → CORRECT
```

---

## PHASE 5: OUTPUT FORMAT FIXES

### ISSUE BLOCK: 5.x (5 issues)

### ISSUE 5.1 — SIMULTANEOUS HUMAN-READABLE + JSON OUTPUT CAUSES FAILURES
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Single-pass dual formatting breaks syntax.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: enforce_two_pass_generation()
  # STRICT TWO-PASS PROTOCOL
  
  PASS_1:
    output_type: "REPORT_ONLY"
    format: "Human-readable markdown"
    content:
      - Audit mode determination
      - Author profile classification
      - Extracted skeleton
      - Quick screening results
      - Gate status L1-L4
      - Scores and evaluations
      - Critical holes
      - Character analysis
      - Grief architecture
      - Finale and dilemma
      - Patches recommended
      - Cult potential
      - Contrastive analysis
      - Final score X/52
      - 3 priority actions
    termination_marker: "[PASS_1_COMPLETE]"
    
  PASS_2:
    trigger: PASS_1_complete AND NOT gate_failed
    output_type: "JSON_ONLY"
    format: "Pure JSON block"
    content:
      - Complete JSON structure per protocol specification
    termination_marker: "[PASS_2_COMPLETE]"
    
  FORBIDDEN:
    - Mixed markdown and JSON in single pass
    - JSON embedded in markdown prose
    - Markdown formatting inside JSON values
```

#### OUTPUT SEQUENCE
```
SEQUENCE:
  
  [PASS_1_START]
  ... human-readable report ...
  [PASS_1_COMPLETE]
  
  [PASS_2_START]
  ```json
  {
    ... complete JSON ...
  }
  ```
  [PASS_2_COMPLETE]
  
  [AUDIT_COMPLETE]
```

---

### ISSUE 5.2 — JSON BOOLEAN-FLAG OVERLOAD
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
50+ bools create precision illusion.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: reduce_json_to_core_metrics()
  # Reduce to 10-15 core metrics
  # Move nuanced diagnostics to narrative_justification fields
  
  CORE_JSON_STRUCTURE:
    {
      "audit_meta": {
        "mode": "conflict|kishō|hybrid",
        "media_type": "game|novel|film|anime|series|ttrpg",
        "applicable_items": <number>
      },
      
      "author_profile": {
        "type": "gardener|hybrid|architect",
        "percentage": <number>,
        "confidence": "high|medium|low"
      },
      
      "skeleton": {
        "thematic_law": "<string>",
        "root_trauma": "<string>",
        "hamartia": "<string>",
        "dominant_grief_stage": "<string>"
      },
      
      "gate_results": {
        "L1_score": "<number>%",
        "L1_passed": <boolean>,
        "L2_score": "<number>%",
        "L2_passed": <boolean>,
        "L3_score": "<number>%",
        "L3_passed": <boolean>,
        "L4_score": "<number>%"
      },
      
      "overall_score": {
        "checklist": "<number>/<number>",
        "percentage": "<number>%",
        "classification": "cult_masterpiece|powerful|living_weak_soul|decoration"
      },
      
      "critical_issues": [
        {
          "id": "<string>",
          "level": "L1|L2|L3|L4",
          "severity": "critical|major|minor",
          "narrative_justification": "<string>"
        }
      ],
      
      "priority_actions": [
        "<action_1>",
        "<action_2>",
        "<action_3>"
      ]
    }
```

#### NARRATIVE_JUSTIFICATION STRUCTURE
```
FOR each metric:
  IF nuanced_diagnostic_needed THEN
    field: {
      "value": <primary_value>,
      "narrative_justification": "<explanation with evidence>",
      "edge_cases": ["<case_1>", "<case_2>"]
    }
  END IF
```

---

### ISSUE 5.3 — CHECKBOX FALLACY
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Flags set on trigger words, not functional integration.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: enforce_citation_and_function_requirement()
  
  FOR each check_set_to_true:
    REQUIRED:
      citation:
        source: "<direct_quote_from_text>"
        location: "<scene/chapter reference>"
      
      functional_role:
        description: "<how this serves criterion functionally>"
        integration: "<how this connects to other elements>"
        
    FORMAT:
      ```
      CHECK: [criterion_name]
      STATUS: TRUE
      CITATION: "[quote]"
      FUNCTIONAL_ROLE: "[one sentence explaining narrative function]"
      ```
      
    IF citation.empty OR functional_role.empty THEN
      SET check_status = FALSE
      LOG: "Checkbox fallacy detected - trigger word without functional integration"
    END IF
```

#### EXAMPLE OUTPUT
```
CHECK: "World without agent"
STATUS: TRUE
CITATION: "The war between Faction A and B had been raging for twenty years before [protagonist] arrived."
FUNCTIONAL_ROLE: "Establishes independent world history that predates protagonist, demonstrating world exists without hero."
```

---

### ISSUE 5.4 — SCORE INFLATION / FAIRNESS HALLUCINATION
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
LLM positivity bias inflates results.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: adversarial_self_check()
  # Before finalizing any PASS
  
  FOR each criterion WHERE status == PASS:
    ADVERSARIAL_PROMPT:
      "List 3 reasons this criterion should be FALSE"
      
    reasons_against = generate_counterarguments(criterion, evidence)
    
    IF len(reasons_against) >= 3 AND all_valid(reasons_against) THEN
      # Reconsider PASS
      DOWNGRADE to "MARGINAL_PASS"
      APPEND reasons_against to evaluation
      
    ELIF len(reasons_against) >= 1 AND strong_counter(reasons_against[0]) THEN
      # Require stronger evidence
      REQUEST: "Provide additional evidence to counter: [reasons_against[0]]"
    END IF
    
  CALIBRATION:
    REFERENCE_BASELINES:
      "Disco Elysium": 95%
      "Pathologic": 88%
      "Generic RPG": 45%
      
    IF score > reference_baseline AND quality_indicators < reference_quality THEN
      FLAG: "Score inflation detected"
      RECALIBRATE against baselines
```

#### EXAMPLE ADVERSARIAL CHECK
```
CRITERION: "Equivalent exchange"
INITIAL_STATUS: PASS
EVIDENCE: "Hero loses health when using magic"

ADVERSARIAL_COUNTERARGUMENTS:
  1. "Health regenerates quickly - loss is temporary"
  2. "No narrative consequence for magic use"
  3. "Cost is mechanical, not identity-impacting"

RESULT: DOWNGRADE to "MARGINAL_PASS"
NARRATIVE_JUSTIFICATION: "Mechanical cost exists but lacks narrative/identity weight"
```

---

### ISSUE 5.5 — NO REFERENCE OUTPUT IN PROTOCOL
**STATUS:** MITIGATED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
§VIII validates against 4 canon works but lacks full annotated audit run.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: append_gold_standard_example()
  # Add one complete gold-standard example
  
  GOLD_STANDARD:
    reference_work: "Disco Elysium"
    type: "complete_audit_run"
    purpose: "zero-shot calibration"
    
  EXAMPLE_STRUCTURE:
    ```
    === GOLD STANDARD: DISCO ELYSIUM AUDIT ===
    
    [PHASE_0: MODE]
    Mode: HYBRID (external conflict + internal journey)
    Reason: Protagonist has external mystery + internal identity crisis
    
    [PHASE_1: AUTHOR PROFILE]
    Type: GARDENER (85%)
    Evidence: Branching paths based on character psychology, skills as voices
    
    [PHASE_2: SKELETON]
    Thematic Law: "Political ideology shapes reality" (literally - skills change)
    Root Trauma: Revolution failed, identity lost
    Hamartia: Harry's search for identity destroys every identity he tries
    Pillars: Memory → Politics → Self-deception → Memory
    Grief Dominant: Depression (Harry's amnesia = denial of self)
    
    [PHASE_3: L1 GATE]
    Score: 95%
    Key Strengths:
      - MDA+OT ontological integration (skills = personality fragments)
      - World without agent (Revachol exists independent of Harry)
      - All 17 vitality criteria
    
    [PHASE_4: L2 GATE]
    Score: 92%
    Key Strengths:
      - Embodiment: Harry's body reflects choices
      - NPCs with independent goals
      - No Mary Sue (Harry fails constantly)
    
    [PHASE_5: L3 GATE]
    Score: 94%
    Key Strengths:
      - All 5 grief stages × 4 levels
      - Dominant: Depression (Harry's state)
      - Each character embodies different stage
    
    [PHASE_6: L4 GATE]
    Score: 93%
    Key Strengths:
      - Cornelian finale: ideology vs authenticity
      - Mirror: "Do YOU choose ideology from fear?"
      - Three layers solid
    
    [FINAL_SCORE]
    93/52 items applicable = equivalent
    Classification: CULT_MASTERPIECE
    
    === END GOLD STANDARD ===
    ```
    
  CALIBRATION_USAGE:
    BEFORE audit:
      LOAD gold_standard
      ESTABLISH baseline expectations
    DURING audit:
      COMPARE current evaluation to gold_standard patterns
      IF current_score >> gold_standard AND evidence << gold_standard THEN
        RECALIBRATE down
```

---

## PHASE 6: STRUCTURAL GAP FIXES

### ISSUE BLOCK: 6.x (8 issues)

### ISSUE 6.1 — KISHŌ MODE UNDER-SPECIFIED
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Lacks detection depth vs Conflict mode.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_kishō_checklist()
  # Dedicated Kishō checklist
  
  KISHŌ_STRUCTURE:
    Ki (Immersion): "Establish state, not conflict"
    Shō (Deepening): "Details with double meaning"
    Ten (Cognitive shift): "Realization that 'normal' was defense mechanism"
    Ketsu (Resonance): "Echo in audience consciousness, not resolution"
    
  KISHŌ_CHECKLIST:
  
    [KISHŌ_KI]:
      - [ ] Opening establishes emotional state, not problem to solve
      - [ ] No clear antagonist or external threat
      - [ ] Atmosphere dominates over plot progression
      - [ ] Character exists in state rather than pursuing goal
      
    [KISHŌ_SHŌ]:
      - [ ] Details have surface meaning AND hidden meaning
      - [ ] Repetition deepens rather than advances
      - [ ] Small moments carry thematic weight
      - [ ] No "rising action" in traditional sense
      
    [KISHŌ_TEN]:
      - [ ] Moment where audience realizes assumption was wrong
      - [ ] Cognitive shift reframes all previous content
      - [ ] "Normal" was actually defense mechanism / limitation
      - [ ] Understanding replaces victory as climax
      
    [KISHŌ_KETSU]:
      - [ ] Ending is resonance, not resolution
      - [ ] No "problem solved" moment
      - [ ] Audience carries question forward
      - [ ] Emotion lingers without closure
      
  KISHŌ_VALIDATION_TEST:
    test_question: "Does Ten recolor previous acts in new meaning?"
    IF answer == "No" THEN
      status: "KISHŌ_STRUCTURE_BROKEN"
      recommendation: "Revise or switch to CONFLICT mode"
```

---

### ISSUE 6.2 — GRIEF ARCHITECTURE 5×4 MATRIX MANDATORY FILLS FORCE CONFABULATION
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
20 intersections exceed canonical works.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: grief_matrix_selective_fill()
  # Require only dominant stage + high-confidence markers
  
  REQUIRED_FILL:
    dominant_stage: "<stage_name>"
    dominant_4_levels: {
      "character": "<name and how they embody>",
      "location": "<place and how it embodies>",
      "mechanic": "<system and how it embodies>",
      "act": "<scene and how it embodies>"
    }
    
  OPTIONAL_FILL:
    cross_level_markers: [
      # 3-5 high-confidence markers across other stages
      {
        "stage": "<stage_name>",
        "level": "<character|location|mechanic|act>",
        "evidence": "<evidence>",
        "confidence": "high"
      }
    ]
    
  ABSENT_MARKING:
    FOR each unfilled_intersection:
      status: "OPTIONAL/ABSENT"
      reason: "Not detected in source material"
      
  FORBIDDEN:
    - Confabulating evidence for unfilled intersections
    - Marking present without textual evidence
    - Assuming all 20 intersections must be filled
```

#### MATRIX OUTPUT FORMAT
```
GRIEF_ARCHITECTURE_MATRIX:

DOMINANT: Depression
CONFIDENCE: HIGH

DEPRESSION (Dominant):
  Character: [Harry] - [amnesia as denial of self]
  Location: [Revachol] - [ruined city reflects internal ruin]
  Mechanic: [Health loss] - [physical reflects psychological]
  Act: [Final confrontation] - [choice determines identity]
  
OTHER_STAGES (Partial):
  Denial:
    Character: [Harry's false memories] - [creating alternate past]
    Confidence: MEDIUM
    Other levels: ABSENT
    
  Anger:
    Mechanic: [Authority skill] - [rage as political tool]
    Confidence: MEDIUM
    Other levels: ABSENT
    
  Bargaining: OPTIONAL/ABSENT
  Acceptance: OPTIONAL/ABSENT
```

---

### ISSUE 6.3 — CROSS-LEVEL CONSISTENCY CHECK (§1.6) MISPLACED
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
Sits in L1 but needs L2-L4 data.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: relocate_cross_check()
  # Move §1.6 to final CROSS-CHECK phase
  
  RELOCATION:
    FROM: Part I (L1 - Mechanism)
    TO: New phase after L4 completion
    
  NEW_PHASE_NAME: "CROSS-CHECK"
  EXECUTION_ORDER: After L4 gate passed
  
  CROSS_CHECK_PROTOCOL:
    AFTER all_gates_passed:
      RUN cross_level_consistency_check
      
      CHECKS:
        1. MDA+OT alignment:
           - Does Mechanics align with Ontology?
           - Does Aesthetics match Dynamics?
           - Flag any contradictions
           
        2. Grief-to-Theme alignment:
           - Does dominant grief stage match thematic law?
           - Are character grief stages consistent with their beliefs?
           
        3. Finale-to-Skeleton alignment:
           - Does finale fulfill Central Question?
           - Does outcome match Hamartia prediction?
           
        4. Media-appropriate elements:
           - If GAME: Are mechanics thematically integrated?
           - If VISUAL: Are visual motifs consistent?
           
      OUTPUT:
        ALIGNMENT_SCORE: <percentage>
        CONTRADICTIONS: [<list of misalignments>]
```

---

### ISSUE 6.4 — NO PATCH PRIORITIZATION
**STATUS:** PARTIALLY RESOLVED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Decision tree exists but lacks dependency ordering.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: enforce_upstream_first_logic()
  # Fix L1 foundations before L3 symptoms
  
  PATCH_PRIORITY_ORDER:
    
    TIER_1 (CRITICAL - Fix First):
      - L1 gate failures
      - Structural skeleton issues
      - Thematic Law violations
      
    TIER_2 (IMPORTANT - Fix Second):
      - L2 gate failures
      - Character consistency issues
      - Logical holes
      
    TIER_3 (ENHANCEMENT - Fix Third):
      - L3 gate failures
      - Grief architecture gaps
      - Depth issues
      
    TIER_4 (POLISH - Fix Last):
      - L4 gate failures
      - Cult potential improvements
      - Mirror refinement
      
  DEPENDENCY_TAGS:
    FOR each issue:
      tag: "BLOCKS" | "BLOCKED_BY" | "INDEPENDENT"
      
    EXAMPLE:
      Issue_A: "Weak Thematic Law"
      Tags: "BLOCKS: Issues B, C, D"
      
      Issue_B: "Grief stages don't connect to theme"
      Tags: "BLOCKED_BY: Issue A"
      
  PRIORITIZATION_ALGORITHM:
    FOR each issue:
      IF issue has "BLOCKED_BY" THEN
        priority = get_priority(issue.BLOCKED_BY) + 1
      ELSE
        priority = tier_base_priority
      END IF
```

#### OUTPUT FORMAT
```
PATCH_PRIORITY_LIST:

TIER_1 (CRITICAL):
  1. [ISSUE-01] Weak Thematic Law
     Type: L1-Skeleton
     Severity: Critical
     Blocks: ISSUE-05, ISSUE-08, ISSUE-12
     Recommended: Radical revision
     
  2. [ISSUE-02] World created for protagonist
     Type: L1-Vitality
     Severity: Critical
     Blocks: ISSUE-09
     Recommended: Compromise
     
TIER_2 (IMPORTANT):
  3. [ISSUE-05] Grief stages not connected to theme
     Type: L3-Architecture
     Severity: Major
     Blocked by: ISSUE-01
     Wait for: ISSUE-01 resolution
     
[... etc ...]
```

---

### ISSUE 6.5 — PATCH GENERATION UNCONSTRAINED
**STATUS:** PARTIALLY RESOLVED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
Template misses core anchors.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: mandate_patch_anchors()
  # Required elements for every patch
  
  PATCH_TEMPLATE:
    ```
    ISSUE: [ID — ISSUE-XX]
    Type: [from 7 types]
    Severity: critical | major | minor
    Tier: 1 | 2 | 3 | 4
    
    DIAGNOSIS:
      Problem: [one sentence]
      Root cause: [one sentence]
      
    THEMATIC_LAW_LINK:
      How this issue affects or violates Thematic Law: [required]
      
    PILLAR_IMPACT:
      Which pillars (A→B→C→A) are affected: [required]
      
    NARRATIVE_COST:
      What must be sacrificed to fix: [required]
      
    RECOMMENDED_FIX:
      Type: Conservative | Compromise | Radical
      Snippet: [3 sentences MAX - ready-to-use text]
      Ripple effects: [what else changes]
      
    VALIDATION:
      How to verify fix works: [test scenario]
    ```
```

#### EXAMPLE PATCH
```
ISSUE: ISSUE-07
Type: Logic hole - Competence
Severity: Major
Tier: 2

DIAGNOSIS:
  Problem: Smart character makes obvious mistake for plot convenience
  Root cause: Author needed character to fail but no organic reason
  
THEMATIC_LAW_LINK:
  Violates "choices have irreversible costs" - mistake is reversible
  
PILLAR_IMPACT:
  Affects: Pillar C (Consequences) - mistake has no real cost
  
NARRATIVE_COST:
  Sacrifice: One scene must be rewritten, minor timeline adjustment
  
RECOMMENDED_FIX:
  Type: Compromise
  Snippet: "Add information barrier - character didn't know [X] because [Y] kept it hidden. This explains the mistake without dumbing down."
  Ripple effects: [Y] needs introduction 2 scenes earlier
  
VALIDATION:
  Test: Would character still make this choice with full information?
  Expected: No - therefore information barrier must be convincing
```

---

### ISSUE 6.6 — UNRELIABLE NARRATOR / SUBJECTIVE REALITY UNFORMALIZED
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Epistemic distortion undermines L3/L4.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: introduce_perception_distortion_module()
  # L3.5 module for narrator reliability
  
  NEW_MODULE: "L3.5: Perception Distortion"
  
  EXECUTION_ORDER: Between L3 and L4
  
  COMPONENTS:
    
    1. NARRATOR_RELIABILITY_TRACKER:
       questions:
         - "Is narrator perspective limited or omniscient?"
         - "Has narrator been shown to misinterpret events?"
         - "Are there contradictions between narrator claims and shown reality?"
         - "Does narrator have motivation to distort?"
         
       status: RELIABLE | UNRELIABLE | PARTIALLY_RELIABLE | UNKNOWN
       
    2. REALITY_SHIFT_MARKERS:
       indicators:
         - "Events described differently by different characters"
         - "Hallucinations, dreams, or altered states"
         - "Time inconsistencies"
         - "Memory gaps or revisions"
         
       detection: [list of detected markers]
       
    3. TRUTH_DECAY_TRACKING:
       tracking:
         - "Which 'facts' might be narrator interpretation?"
         - "Which events have multiple interpretations?"
         - "Where might audience be mislead intentionally?"
         
  OUTPUT_INTEGRATION:
    FOR each L3/L4 evaluation:
      APPEND reliability_context
      
    EXAMPLE:
      "Grief stage: Depression (VERIFIED)
       Context: Narrator reliability: PARTIALLY_RELIABLE
       Evidence may reflect narrator's depression, not objective reality"
```

---

### ISSUE 6.7 — NO ITERATIVE FEEDBACK LOOP
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
Single-pass workflow.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_re_evaluate_step()
  # After patching, rescore affected gates
  
  RE_EVALUATE_PROTOCOL:
    
    TRIGGER: After patch application
    
    PROCESS:
      1. Identify affected_level:
         patch_level = extract_level(patch.issue_id)
         
      2. Rescore ONLY affected level:
         new_score = calculate_score_L(patch_level, updated_source)
         
      3. Propagate deltas:
         FOR each level FROM patch_level TO L4:
           IF level_gate_passed Previously AND NOT now THEN
             FLAG: "Gate regression detected"
             ALERT: "Patch caused downstream failure"
           ELIF level_gate_failed Previously AND passed now THEN
             FLAG: "Gate improvement detected"
             CONTINUE: to next level
           END IF
         END FOR
         
    ITERATION_LIMIT:
      max_iterations: 3
      IF iterations > max_iterations THEN
        ALERT: "Audit stalled - recommend manual review"
        TERMINATE
      END IF
      
  STATE_TRACKING:
    maintain: {
      "iteration_count": <number>,
      "previous_scores": {L1, L2, L3, L4},
      "patches_applied": [<list>],
      "gates_changed": [<list>]
    }
```

---

### ISSUE 6.8 — NO INPUT PREPROCESSING SPECIFICATION
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
Assumes clean 1-3 paragraph summary.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: define_input_tiers()
  # Input tiers with corresponding audit depth
  
  INPUT_TIERS:
    
    TIER_1: "BRAINSTORM"
      characteristics:
        - Fragmented ideas
        - No complete scenes
        - Concept sketches
      audit_depth: "SKELETON_ONLY"
      gate_strictness: "RELAXED" (40% threshold)
      output_focus:
        - Validate core concept
        - Identify structural gaps
        - Suggest development directions
        
    TIER_2: "DRAFT"
      characteristics:
        - Complete narrative arc
        - Some scenes detailed
        - Characters named with basic motivation
      audit_depth: "L1_L2_ONLY"
      gate_strictness: "STANDARD" (60% threshold)
      output_focus:
        - Structural integrity
        - Logical consistency
        - Character foundations
        
    TIER_3: "FINAL"
      characteristics:
        - Complete scenes
        - Dialogue present
        - Full character arcs
      audit_depth: "FULL_L1_L4"
      gate_strictness: "STRICT" (60% threshold, stricter evidence requirements)
      output_focus:
        - Complete audit
        - Nuanced analysis
        - Polish recommendations
        
  TIER_DETECTION:
    indicators:
      BRAINSTORM:
        - Text < 500 words
        - No dialogue
        - Concept descriptions only
      DRAFT:
        - Text 500-2000 words
        - Some scene descriptions
        - Basic character interaction
      FINAL:
        - Text > 2000 words
        - Full scenes with dialogue
        - Detailed descriptions
```

---

## PHASE 7: CALIBRATION & SCOPE BIAS FIXES

### ISSUE BLOCK: 7.x (6 issues)

### ISSUE 7.1 — TONAL BIAS TOWARD TRAGIC REALISM
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Optimized for grimdark/existential; penalizes comedy/slice-of-life.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_tonality_mode_selector()
  # Add TONALITY_MODE in Step 0
  
  STEP_0_ENHANCED:
    BEFORE audit_mode_selection:
      
      PROMPT: "Select TONALITY_MODE:
        - TRAGIC_REALISM (default: grimdark, existential weight)
        - COMEDY (absurdity, subversion, lightness)
        - SLICE_OF_LIFE (daily life, small moments)
        - ADVENTURE (heroic, optimistic)
        - HORROR (dread, inevitability)
        - MIXED (multiple tones)"
        
  TONALITY_ADJUSTMENTS:
    
    TRAGIC_REALISM:
      embodiment_threshold: STANDARD
      grief_weight: FULL
      finale_requirement: "Irreversible loss"
      
    COMEDY:
      embodiment_threshold: LOWERED (absurdity acceptable)
      grief_weight: REDUCED (situational comedy)
      finale_requirement: "Satisfying subversion"
      special_check: "Does comedy undermine stakes or enhance them?"
      
    SLICE_OF_LIFE:
      embodiment_threshold: HIGH (daily details matter)
      grief_weight: MILD (losses are small)
      finale_requirement: "Meaningful small change"
      special_check: "Do small moments carry thematic weight?"
      
    ADVENTURE:
      embodiment_threshold: STANDARD
      grief_weight: MODERATE (losses exist but overcome)
      finale_requirement: "Earned triumph"
      special_check: "Is victory earned through growth?"
      
    HORROR:
      embodiment_threshold: HIGH (sensory detail critical)
      grief_weight: VARIES (loss as dread)
      finale_requirement: "Survival or meaningful sacrifice"
      special_check: "Does dread build through structure?"
```

---

### ISSUE 7.2 — INTENTIONAL DESIGN VIOLATIONS NOT DISTINGUISHABLE FROM FAILURES
**STATUS:** CONFIRMED
**PRIORITY:** HIGH

#### PROBLEM DEFINITION
Artistic friction misfires as errors.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_intentional_breach_flag()
  # Flag for deliberate violations
  
  INTENTIONAL_BREACH_PROTOCOL:
    
    FOR each detected_violation:
      ASSESS:
        1. Is there explicit authorial justification?
        2. Does violation serve thematic purpose?
        3. Is violation consistent throughout?
        
      IF all_assessments_true THEN
        status: "INTENTIONAL_BREACH"
        REQUIRE:
          - explicit_authorial_justification: "<text>"
          - thematic_alignment_proof: "<explanation>"
          
        DO_NOT_SCORE_AS_FAILURE
        
      ELSE
        status: "UNINTENTIONAL_VIOLATION"
        SCORE_AS_FAILURE
      END IF
      
  OUTPUT_FORMAT:
    ```
    VIOLATION: [description]
    TYPE: Intentional Breach | Unintentional Violation
    
    IF Intentional Breach:
      Authorial Justification: [provided reason]
      Thematic Purpose: [how violation serves theme]
      Consistency: [is this sustained throughout]
      
    IF Unintentional Violation:
      Fix Recommended: [suggested correction]
    ```
```

---

### ISSUE 7.3 — VOICE UNIQUENESS / CLICHÉ DETECTION ABSENT
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
High logic/depth can still be derivative.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_archetype_parasite_scan()
  # L4 enhancement for trope detection
  
  NEW_CHECK: "Archetype-Parasite Scan"
  LOCATION: L4 supplementary analysis
  
  SCAN_COMPONENTS:
    
    1. TROPE_IDENTIFICATION:
       check_list:
         - "Chosen One protagonist"
         - "Dark Lord antagonist"
         - "Love interest as reward"
         - "Training montage"
         - "Last-minute power-up"
         - "Death fake-out"
         - "Villain explains plan"
         - "Hero's sacrifice reversed"
         
       FOR each detected_trope:
         status: "PRESENT"
         treatment: "straight" | "subverted" | "deconstructed"
         
    2. SUBVERSION_RATIO:
       calculation:
         subverted_tropes = COUNT(tropes WHERE treatment == "subverted" OR "deconstructed")
         total_tropes = COUNT(all_detected_tropes)
         ratio = subverted_tropes / total_tropes
         
       threshold: ratio >= 0.3 for original voice
       
    3. DERIVATION_CHECK:
       questions:
         - "Could this scene be in another work without changes?"
         - "Is character motivation standard for their archetype?"
         - "Does dialogue sound like generic fantasy/sci-fi?"
         
       IF derivation_score > 0.5 THEN
         FLAG: "High derivation risk"
         SUGGEST: "Add unique voice elements"
```

---

### ISSUE 7.4 — AUTHOR ETHICS SECTION (L4) NOT LLM-OPERABLE
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
Introspective questions fail on AI.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: replace_with_text_inferrable_proxies()
  # Replace introspective questions with text analysis
  
  AUTHOR_ETHICS_PROXIES:
    
    ORIGINAL_QUESTION: "What do I fear showing in this world?"
    PROXY_INDICATORS:
      - "systematic_thematic_avoidance": 
          detection: "Topic repeatedly approached but never confronted"
          example: "Death mentioned 20 times but never shown directly"
          
      - "narrative_shielding":
          detection: "Characters protected from consequences of their actions"
          example: "Protagonist makes terrible choice but world bends to make it okay"
          
      - "proxy_fear_markers":
          detection: "Pattern of avoiding specific emotional territory"
          across_scenes: "3+ scenes where expected emotion is deflected"
          
  PROXY_ANALYSIS:
    
    FOR each proxy_indicator:
      SCAN source_text for pattern
      
      IF pattern_detected THEN
        REPORT:
          indicator: "<name>"
          evidence: "<quotes>"
          interpretation: "<what this suggests about author's avoidance>"
```

---

### ISSUE 7.5 — GARDENER PROFILE GIVEN NO INCOMPLETENESS TOOLS
**STATUS:** CONFIRMED
**PRIORITY:** MEDIUM

#### PROBLEM DEFINITION
"Organic chaos" flagged but lacks audit path for live worlds.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: add_emergence_mode()
  # Alternative audit for organic/live worlds
  
  EMERGENCE_MODE:
    
    TRIGGER:
      author_profile == "GARDENER"
      AND organic_chaos_detected
      
    ADJUSTMENTS:
      
      1. SCORE_POTENTIAL:
         "Instead of 'is it complete?', ask 'does it have potential?'"
         
         criteria:
           - "Are seeds planted for future development?"
           - "Do unresolved threads have clear potential?"
           - "Is there room for emergent stories?"
           
      2. TRACK_UNRESOLVED_THREADS:
         format:
           ```
           UNRESOLVED THREAD: [description]
           Status: Intentional | Accidental
           Potential: HIGH | MEDIUM | LOW
           Development path: [suggested direction]
           ```
           
      3. DEFER_STRUCTURAL_FORCING:
         "Do not penalize for:"
           - Open endings (if intentional)
           - Loose threads (if have potential)
           - Ambiguity (if thematically appropriate)
           
    OUTPUT_ADDITION:
      EMERGENCE_ASSESSMENT:
        unresolved_threads: [<list>]
        potential_score: <number>
        development_recommendations: [<list>]
```

---

### ISSUE 7.6 — PROTOCOL HAS NO SELF-AUDIT PROCEDURE
**STATUS:** CONFIRMED
**PRIORITY:** LOW

#### PROBLEM DEFINITION
Blind zones acknowledged but not recursively checked.

#### IMPLEMENTATION DIRECTIVE

```pseudo
FUNCTION: require_self_audit_pass()
  # Periodic self-audit of protocol
  
  SELF_AUDIT_PROTOCOL:
    
    TRIGGER: Periodic (recommended: monthly)
    
    PROCESS:
      1. Run v10.0 through its own L1-L4 framework
      2. Evaluate protocol as "world"
      3. Identify blind spots
      4. Publish delta report
      
    PROTOCOL_AS_WORLD:
      
      L1_ANALYSIS:
        thematic_law: "Consistency enables trust"
        internal_consistency: CHECK
        logical_holes: CHECK
        
      L2_ANALYSIS:
        embodiment: "Are examples concrete?"
        evidence_quality: CHECK
        
      L3_ANALYSIS:
        grief_architecture: "Does protocol handle emotional content?"
        psychological_depth: CHECK
        
      L4_ANALYSIS:
        mirror: "Does protocol help user grow?"
        ethics: CHECK
        
    DELTA_REPORT_FORMAT:
      ```
      SELF-AUDIT DATE: [date]
      VERSION: v10.0
      
      BLIND SPOTS IDENTIFIED:
        1. [blind spot]
        2. [blind spot]
        
      CONTRADICTIONS FOUND:
        1. [contradiction]
        
      RECOMMENDATIONS:
        1. [recommendation]
        
      DELTA FROM LAST AUDIT: [changes]
      ```
```

---

## PHASE 8: FINAL EXECUTION CHECKLIST

### PRE-EXECUTION CHECKS

```pseudo
FUNCTION: pre_execution_validation()
  
  CHECKS:
    [ ] Protocol loaded as system prompt
    [ ] Glossary block attached
    [ ] Media type identified
    [ ] Input tier determined
    [ ] Tonality mode selected
    [ ] State snapshot directory created
    
  IF any_check_failed THEN
    HALT: "Pre-execution validation failed"
    OUTPUT: failed_checks list
  END IF
```

### EXECUTION SEQUENCE

```
[PHASE_0] Context Loading → [PASS]
    ↓
[PHASE_1] Mode Detection → Mode identified
    ↓
[PHASE_2] Author Profile → Profile classified
    ↓
[PHASE_3] Skeleton Extraction → Skeleton complete
    ↓
[PHASE_4] Quick Screening → Flags identified
    ↓
[GATE_L1] → IF PASS continue, ELSE STOP + fix list
    ↓
[GATE_L2] → IF PASS continue, ELSE STOP + fix list
    ↓
[GATE_L3] → IF PASS continue, ELSE STOP + fix list
    ↓
[L3.5] Perception Distortion → Reliability tracked
    ↓
[GATE_L4] → IF PASS continue, ELSE STOP + fix list
    ↓
[CROSS_CHECK] → Alignment verified
    ↓
[PATCH_GENERATION] → Prioritized patches generated
    ↓
[PASS_1] Human-readable report
    ↓
[PASS_2] JSON output
    ↓
[AUDIT_COMPLETE]
```

### OUTPUT VALIDATION

```pseudo
FUNCTION: validate_output()
  
  REQUIRED_ELEMENTS:
    [ ] Mode specified
    [ ] Author profile with confidence
    [ ] Skeleton elements all present
    [ ] All gate scores calculated
    [ ] Gate failure triggers termination
    [ ] Evidence chains for all PASS
    [ ] Citations for all TRUE flags
    [ ] Priority actions: exactly 3
    [ ] JSON in separate pass
    
  IF validation_failed THEN
    LOG: "Output validation failed"
    OUTPUT: missing_elements list
  END IF
```

---

## APPENDIX: QUICK REFERENCE CARD

### GATE THRESHOLDS
```
L1 (Mechanism): ≥60% → PASS
L2 (Body): ≥60% → PASS
L3 (Psyche): ≥60% → PASS
L4 (Meta): ≥60% → PASS
```

### SCORING FORMULA
```
Score_L = (Passed_Applicable_L / Total_Applicable_L) * 100
EXCLUDE: media-inapplicable items
EXCLUDE: INSUFFICIENT_DATA items
```

### MEDIA TAGS
```
[CORE]   → All media
[GAME]   → Games only
[VISUAL] → Film/Anime/Series
```

### BOUNDARY TOKENS
```
[GATE_L1] [GATE_L2] [GATE_L3] [GATE_L4]
[STOP_IF_FAIL] [PROCEED_Lx]
[GATE_PASSED:Lx] [GATE_FAILED:Lx]
```

### OUTPUT PASSES
```
PASS_1: Human-readable report (markdown)
PASS_2: JSON only (pure JSON block)
```

---

## END OF IMPLEMENTATION PLAN

```
[PLAN_VERSION: 1.0]
[TOTAL_ISSUES_ADDRESSED: 32]
[CONFIRMED_ISSUES: 28]
[PARTIALLY_RESOLVED: 2]
[MITIGATED: 1]
[RELOCATION_REQUIRED: 1]
[STATUS: READY_FOR_AGENT_EXECUTION]
```
