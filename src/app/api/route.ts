// Universe Audit Protocol v10.0 - Full Audit Analysis API
// INTEGRATED VERSION - All audit modules connected
import { NextRequest, NextResponse } from 'next/server';
import { getLLMClient, type LLMProvider } from '@/lib/llm-client';
import { 
  AUDIT_SYSTEM_PROMPT,
  getAuditModePrompt,
  getSkeletonExtractionPrompt,
  getScreeningPrompt,
  getL1EvaluationPrompt,
  getL2EvaluationPrompt,
  getL3EvaluationPrompt,
  getL4EvaluationPrompt,
} from '@/lib/audit/prompts';
import { 
  MASTER_CHECKLIST,
  GATE_THRESHOLD,
} from '@/lib/audit/protocol-data';
import { 
  filterByMediaType, 
  evaluateGate,
  classifyAuthorProfile,
  calculateOverallScore,
  initializeGriefMatrix,
} from '@/lib/audit/scoring-algorithm';

// TIER 0 - Foundation
import { 
  detectAuditMode, 
  getModeExecutionConfig, 
  validateAuditMode,
  executeTenRepaintingTest,
  type ModeIndicators 
} from '@/lib/audit/modes';
import { 
  calculateAuthorProfile, 
  getProfileConfig, 
  reorderSectionsByPriority,
  type ProfileIndicators 
} from '@/lib/audit/author-profile';
import { 
  GateExecutionController,
  validatePrerequisites,
  createBlockedStatus,
  createGateFailedOutput,
} from '@/lib/audit/gate-executor';
import { validateInput, type AuditInput } from '@/lib/audit/input-validator';

// TIER 1 - Data Integrity
import { 
  createIssue, 
  validateIssue, 
  generatePatchTemplates,
  sortIssuesByPriority,
  type Issue,
  type Axes,
} from '@/lib/audit/issue-schema';
import { 
  validateGriefArchitecture, 
  executeL3GateWithGriefCheck,
  analyzeGriefInText,
  type GriefPresence,
} from '@/lib/audit/grief-validation';
import { assignLevel, partitionByLevel, type AuditItem } from '@/lib/audit/level-assignment';
import { 
  evaluateCultPotential, 
  quickCultCheck,
  type CultEvaluationInput 
} from '@/lib/audit/cult-potential';
import { 
  extractSkeleton, 
  isSkeletonViable, 
  formatSkeletonResult,
  type SkeletonExtractionResult 
} from '@/lib/audit/skeleton-extraction';
import { 
  runWhatForChain, 
  classifyTerminal,
  type ChainResult 
} from '@/lib/audit/what-for-chain';

// TIER 2 - Protocol Fidelity
import { 
  runFiveChecks, 
  runFiveTouches, 
  validateNewElement,
} from '@/lib/audit/new-element-validation';
import { 
  transformSectionForMedia, 
  applyMediaTransformation,
} from '@/lib/audit/media-transformation';
import { 
  deriveGriefStageFromLaw, 
  deriveDilemmaFromTheme,
} from '@/lib/audit/generative-templates';

// TIER 3 - Diagnostics
import { formatComparativeAnalysis, type ComparativeEntry } from '@/lib/audit/diagnostics';

import type { 
  MediaType, 
  AuditMode, 
  AuthorProfileAnswers,
  AuthorProfile,
  Skeleton,
  ScreeningResult,
  GateResult,
  ChecklistItem,
  GriefArchitectureMatrix,
  AuditReport,
  GriefStage,
  AuditPhase,
} from '@/lib/audit/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AnalyzeRequest {
  narrative: string;
  mediaType: MediaType;
  authorAnswers?: AuthorProfileAnswers;
  provider?: LLMProvider | null;
  apiKey?: string | null;
  model?: string | null;
}

interface AnalyzeResponse {
  success: boolean;
  
  // Phase tracking
  phase: AuditPhase;
  
  // T0 - Foundation
  auditMode: AuditMode | null;
  modeConfig: ReturnType<typeof getModeExecutionConfig> | null;
  authorProfile: AuthorProfile | null;
  profileConfig: ReturnType<typeof getProfileConfig> | null;
  
  // T1 - Data Integrity
  skeleton: Skeleton | null;
  skeletonValidation: SkeletonExtractionResult | null;
  screeningResult: ScreeningResult | null;
  
  // Gate Results with halt tracking
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  halted: boolean;
  haltReason: string | null;
  
  // Checklist and Issues
  checklist: ChecklistItem[];
  issues: Issue[];
  
  // Grief Architecture
  griefMatrix: GriefArchitectureMatrix | null;
  griefValidation: ReturnType<typeof validateGriefArchitecture> | null;
  
  // Cult Potential
  cultPotential: ReturnType<typeof evaluateCultPotential> | null;
  
  // What-for chain results
  whatForChains: ChainResult[];
  
  // Final Report
  report: AuditReport | null;
  
  // Errors and warnings
  error?: string;
  warnings: string[];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json() as AnalyzeRequest;
    const { narrative, mediaType, authorAnswers, provider, apiKey, model } = body;
    
    // ========================================================================
    // STEP 0: INPUT VALIDATION (T0.4)
    // ========================================================================
    
    const inputValidation = validateInput({
      concept: narrative,
      media_type: mediaType,
      author_answers: authorAnswers,
    });
    
    if (!inputValidation.valid) {
      return NextResponse.json({
        success: false,
        phase: 'idle',
        error: `Missing required fields: ${inputValidation.missing_fields.join(', ')}`,
        status: 'blocked',
        reason: inputValidation.reason,
      }, { status: 400 });
    }
    
    // Initialize LLM client
    const llm = await getLLMClient(provider, apiKey, model);
    
    // Initialize response object
    const response: AnalyzeResponse = {
      success: true,
      phase: 'mode_selection',
      auditMode: null,
      modeConfig: null,
      authorProfile: null,
      profileConfig: null,
      skeleton: null,
      skeletonValidation: null,
      screeningResult: null,
      gateResults: { L1: null, L2: null, L3: null, L4: null },
      halted: false,
      haltReason: null,
      checklist: filterByMediaType([...MASTER_CHECKLIST], mediaType),
      issues: [],
      griefMatrix: initializeGriefMatrix(),
      griefValidation: null,
      cultPotential: null,
      whatForChains: [],
      report: null,
      warnings: [],
    };
    
    // ========================================================================
    // STEP 1: AUDIT MODE DETECTION (T0.1)
    // ========================================================================
    
    response.phase = 'mode_selection';
    
    // Get mode indicators from LLM
    const modeIndicatorCompletion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: 'You analyze narrative structure. Return only JSON with these fields: hasMultipleWorldviews (boolean), hasSystematicInconsistencies (boolean), hasCanonicalContradictions (boolean), hasAuthorUncertainty (boolean), hasIntentionalAmbiguity (boolean), kishoScore (0-1).' },
        { role: 'user', content: `Analyze this narrative for mode detection:\n\n${narrative.slice(0, 3000)}` }
      ],
      temperature: 0.2,
      max_tokens: 300,
    });
    
    let modeIndicators: ModeIndicators = {
      hasMultipleWorldviews: false,
      hasSystematicInconsistencies: false,
      hasCanonicalContradictions: false,
      hasAuthorUncertainty: false,
      hasIntentionalAmbiguity: false,
      kishōScore: 0,
    };
    
    try {
      const modeMatch = modeIndicatorCompletion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (modeMatch) {
        modeIndicators = JSON.parse(modeMatch[0]);
      }
    } catch {
      // Use defaults
    }
    
    // Detect audit mode using T0.1 module
    response.auditMode = detectAuditMode(modeIndicators);
    response.modeConfig = getModeExecutionConfig(response.auditMode);
    
    // Validate mode prerequisites
    const modeValidation = validateAuditMode(response.auditMode, {
      hasAuthorAccess: false,
      canRunRepaintingTest: true,
      hasCanonicalSources: true,
    });
    
    if (modeValidation.requirements.length > 0) {
      response.warnings.push(...modeValidation.requirements);
    }
    
    // ========================================================================
    // STEP 2: AUTHOR PROFILE CALCULATION (T0.2)
    // ========================================================================
    
    response.phase = 'author_profile';
    
    if (authorAnswers) {
      // Calculate from provided answers
      response.authorProfile = classifyAuthorProfile(authorAnswers);
    } else {
      // Infer from narrative
      const profileIndicatorCompletion = await llm.chat.completions.create({
        messages: [
          { role: 'system', content: 'You analyze author working styles. Return only JSON with these boolean fields: iterativeDrafts, characterFirst, plotFirst, organicDevelopment, structuredOutlining, themeEmergence, themeDefined, plus worldbuildingDepth (0-1) and characterDepth (0-1).' },
          { role: 'user', content: `Analyze author style from this narrative:\n\n${narrative.slice(0, 2000)}` }
        ],
        temperature: 0.3,
        max_tokens: 400,
      });
      
      let profileIndicators: ProfileIndicators = {
        iterativeDrafts: false,
        characterFirst: false,
        plotFirst: false,
        organicDevelopment: false,
        structuredOutlining: false,
        themeEmergence: false,
        themeDefined: false,
        worldbuildingDepth: 0.5,
        characterDepth: 0.5,
      };
      
      try {
        const profileMatch = profileIndicatorCompletion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
        if (profileMatch) {
          profileIndicators = JSON.parse(profileMatch[0]);
        }
      } catch {
        // Use defaults
      }
      
      const calculatedProfile = calculateAuthorProfile(profileIndicators);
      response.authorProfile = {
        type: calculatedProfile,
        percentage: profileIndicators.characterDepth * 100,
        confidence: 'medium',
        mainRisks: getProfileConfig(calculatedProfile).riskFlags,
        auditPriorities: getProfileConfig(calculatedProfile).priorityArray,
      };
    }
    
    response.profileConfig = getProfileConfig(response.authorProfile.type);
    
    // Reorder sections by author priority
    const sectionOrder = reorderSectionsByPriority(response.authorProfile.type);
    
    // ========================================================================
    // STEP 3: SKELETON EXTRACTION WITH WEAKNESS TESTS (T1.5)
    // ========================================================================
    
    response.phase = 'skeleton_extraction';
    
    const skeletonCompletion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: 'You extract narrative structure. Return only JSON with fields: thematic_law, root_trauma, hamartia, pillars (array of 3 strings), emotional_engine, author_prohibition, target_experience, central_question.' },
        { role: 'user', content: getSkeletonExtractionPrompt(narrative, mediaType) }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });
    
    let extractedData: Record<string, unknown> = {};
    try {
      const skeletonMatch = skeletonCompletion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (skeletonMatch) {
        extractedData = JSON.parse(skeletonMatch[0]);
      }
    } catch {
      // Empty data
    }
    
    // Run T1.5 skeleton extraction with weakness tests
    response.skeletonValidation = extractSkeleton(extractedData);
    
    // Build skeleton object
    response.skeleton = {
      thematicLaw: extractedData.thematic_law as string || null,
      rootTrauma: extractedData.root_trauma as string || null,
      hamartia: extractedData.hamartia as string || null,
      pillars: Array.isArray(extractedData.pillars) && extractedData.pillars.length === 3
        ? extractedData.pillars as [string, string, string]
        : [null, null, null],
      emotionalEngine: (extractedData.emotional_engine as GriefStage) || null,
      authorProhibition: extractedData.author_prohibition as string || null,
      targetExperience: extractedData.target_experience as string || null,
      centralQuestion: extractedData.central_question as string || null,
    };
    
    // CRITICAL: Check if skeleton is viable
    if (!response.skeletonValidation.canProceedToL1) {
      response.halted = true;
      response.haltReason = 'Skeleton extraction failed weakness tests';
      response.success = false;
      response.error = `SKELETON INCOMPLETE: ${response.skeletonValidation.blockers.join('; ')}`;
      
      // Generate issues for skeleton failures
      response.skeletonValidation.weaknesses.forEach((w, idx) => {
        const issue = createIssue({
          id: `ISSUE-SKEL-${idx + 1}`,
          location: `§skeleton.${w.element.toLowerCase().replace(' ', '_')}`,
          severity: w.severity === 'critical' ? 'critical' : w.severity === 'major' ? 'major' : 'minor',
          axes: {
            criticality: w.severity === 'critical' ? 9 : w.severity === 'major' ? 6 : 3,
            risk: 5,
            time_cost: 4,
          },
          diagnosis: `${w.element}: ${w.testQuestion} → FAILED`,
          patches: generatePatchTemplates(w.element.toLowerCase().replace(' ', '_'), narrative.slice(0, 100)),
        });
        response.issues.push(issue);
      });
      
      return NextResponse.json(response);
    }
    
    // ========================================================================
    // STEP 4: SCREENING
    // ========================================================================
    
    response.phase = 'screening';
    
    const screeningCompletion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: 'You perform quick narrative screening. Return JSON with "answers" array of 7 booleans for: thematicLaw, worldWithoutProtagonist, embodiment, hamartia, painfulChoice, antagonistLogic, finalIrreversible.' },
        { role: 'user', content: getScreeningPrompt(narrative) }
      ],
      temperature: 0.2,
      max_tokens: 300,
    });
    
    try {
      const screeningMatch = screeningCompletion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (screeningMatch) {
        const parsed = JSON.parse(screeningMatch[0]);
        const answers = parsed.answers as boolean[];
        
        const flags: string[] = [];
        if (!answers[0]) flags.push('§0', '§1.4');
        if (!answers[1]) flags.push('§3', '§4');
        if (!answers[2]) flags.push('§1.5', '§5');
        if (!answers[3]) flags.push('§6');
        if (!answers[4]) flags.push('§2', '§16');
        if (!answers[5]) flags.push('§6', '§8');
        if (!answers[6]) flags.push('§16');
        
        const noCount = answers.filter(a => !a).length;
        let recommendation: ScreeningResult['recommendation'];
        if (noCount <= 1) {
          recommendation = 'ready_for_audit';
        } else if (noCount <= 3) {
          recommendation = 'requires_sections';
        } else {
          recommendation = 'stop_return_to_skeleton';
        }
        
        response.screeningResult = {
          question1_thematicLaw: answers[0],
          question2_worldWithoutProtagonist: answers[1],
          question3_embodiment: answers[2],
          question4_hamartia: answers[3],
          question5_painfulChoice: answers[4],
          question6_antagonistLogic: answers[5],
          question7_finalIrreversible: answers[6],
          flags,
          recommendation,
        };
        
        // Hard stop if screening recommends
        if (recommendation === 'stop_return_to_skeleton') {
          response.warnings.push('Screening recommends returning to skeleton phase');
        }
      }
    } catch {
      response.screeningResult = {
        question1_thematicLaw: false,
        question2_worldWithoutProtagonist: false,
        question3_embodiment: false,
        question4_hamartia: false,
        question5_painfulChoice: false,
        question6_antagonistLogic: false,
        question7_finalIrreversible: false,
        flags: ['All sections'],
        recommendation: 'requires_sections',
      };
    }
    
    // ========================================================================
    // STEP 5: L1 EVALUATION WITH GATE CONTROLLER
    // ========================================================================
    
    response.phase = 'L1_evaluation';
    
    // Initialize gate controller
    const gateController = new GateExecutionController();
    
    const l1Checklist = response.checklist
      .filter(i => i.level.includes('L1'))
      .map(i => `${i.id}: ${i.text} [${i.tag}]`)
      .join('\n');
    
    const l1Completion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL1EvaluationPrompt(narrative, response.skeleton!, mediaType, l1Checklist) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    try {
      const l1Match = l1Completion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (l1Match) {
        const parsed = JSON.parse(l1Match[0]);
        
        if (Array.isArray(parsed.evaluations)) {
          parsed.evaluations.forEach((eval_: { id: string; status: string; evidence?: string; functionalRole?: string }) => {
            const item = response.checklist.find(i => i.id === eval_.id);
            if (item) {
              item.status = eval_.status as ChecklistItem['status'];
              item.evidence = eval_.evidence;
              item.functionalRole = eval_.functionalRole;
            }
          });
        }
        
        response.gateResults.L1 = evaluateGate(response.checklist, 'L1', mediaType);
      }
    } catch {
      response.gateResults.L1 = {
        level: 'L1',
        score: 0,
        passed: false,
        applicableItems: 0,
        passedItems: 0,
        failedItems: 0,
        insufficientDataItems: 0,
        fixList: [],
      };
    }
    
    // GATE CHECK: L1 HALT CONDITION
    if (!response.gateResults.L1?.passed) {
      response.halted = true;
      response.haltReason = `L1 gate failed with score ${response.gateResults.L1?.score}%`;
      response.success = false;
      response.error = response.haltReason;
      
      // Generate issues for failed L1 items
      response.gateResults.L1?.fixList.forEach((fix, idx) => {
        const issue = createIssue({
          id: `ISSUE-L1-${idx + 1}`,
          location: `§${fix.id}`,
          severity: fix.severity,
          axes: {
            criticality: fix.severity === 'critical' ? 9 : fix.severity === 'major' ? 6 : 3,
            risk: 5,
            time_cost: 4,
          },
          diagnosis: fix.description,
          patches: generatePatchTemplates(fix.type, narrative.slice(0, 100)),
        });
        response.issues.push(issue);
      });
      
      return NextResponse.json(response);
    }
    
    // ========================================================================
    // STEP 6: L2 EVALUATION
    // ========================================================================
    
    response.phase = 'L2_evaluation';
    
    const l2Checklist = response.checklist
      .filter(i => i.level.includes('L2'))
      .map(i => `${i.id}: ${i.text}`)
      .join('\n');
    
    const l2Completion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL2EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L1!.score, l2Checklist) }
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });
    
    try {
      const l2Match = l2Completion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (l2Match) {
        const parsed = JSON.parse(l2Match[0]);
        
        if (Array.isArray(parsed.evaluations)) {
          parsed.evaluations.forEach((eval_: { id: string; status: string; evidence?: string; functionalRole?: string }) => {
            const item = response.checklist.find(i => i.id === eval_.id);
            if (item && item.status === 'PENDING') {
              item.status = eval_.status as ChecklistItem['status'];
              item.evidence = eval_.evidence;
              item.functionalRole = eval_.functionalRole;
            }
          });
        }
        
        response.gateResults.L2 = evaluateGate(response.checklist, 'L2', mediaType);
      }
    } catch {
      response.gateResults.L2 = {
        level: 'L2',
        score: 0,
        passed: false,
        applicableItems: 0,
        passedItems: 0,
        failedItems: 0,
        insufficientDataItems: 0,
        fixList: [],
      };
    }
    
    // GATE CHECK: L2 HALT CONDITION
    if (!response.gateResults.L2?.passed) {
      response.halted = true;
      response.haltReason = `L2 gate failed with score ${response.gateResults.L2?.score}%`;
      response.success = false;
      response.error = response.haltReason;
      return NextResponse.json(response);
    }
    
    // ========================================================================
    // STEP 7: L3 EVALUATION WITH GRIEF HARD CHECK (T1.2)
    // ========================================================================
    
    response.phase = 'L3_evaluation';
    
    // CRITICAL: Run grief validation BEFORE L3 scoring
    // This is the HARD CHECK from T1.2
    
    // Analyze grief in narrative
    const griefPresences = analyzeGriefInText(narrative);
    
    // Run L3 gate with grief check
    const l3GriefResult = executeL3GateWithGriefCheck(narrative, griefPresences);
    response.griefValidation = l3GriefResult.validationResult;
    
    // HARD CHECK: If grief validation failed, HALT
    if (!l3GriefResult.passed) {
      response.halted = true;
      response.haltReason = 'L3 Grief Architecture validation failed';
      response.success = false;
      response.error = l3GriefResult.blockReason || 'Grief validation failed';
      
      // Add grief issues
      l3GriefResult.fixes.forEach((fix, idx) => {
        const issue = createIssue({
          id: `ISSUE-L3-GRIEF-${idx + 1}`,
          location: '§grief_architecture',
          severity: 'critical',
          axes: { criticality: 10, risk: 6, time_cost: 5 },
          diagnosis: fix,
          patches: generatePatchTemplates('grief_architecture', narrative.slice(0, 100)),
        });
        response.issues.push(issue);
      });
      
      // Create failed L3 gate result
      response.gateResults.L3 = {
        level: 'L3',
        score: 0,
        passed: false,
        applicableItems: 0,
        passedItems: 0,
        failedItems: 0,
        insufficientDataItems: 0,
        fixList: l3GriefResult.fixes.map((fix, idx) => ({
          id: `FIX-L3-${idx + 1}`,
          description: fix,
          severity: 'critical' as const,
          type: 'ideology' as const,
          recommendedApproach: 'radical' as const,
        })),
      };
      
      return NextResponse.json(response);
    }
    
    // Update grief matrix from validation
    if (l3GriefResult.validationResult.dominantStage) {
      response.griefMatrix = {
        dominantStage: l3GriefResult.validationResult.dominantStage,
        cells: griefPresences.map(p => ({
          stage: p.stage,
          level: p.level === 'world' ? 'character' : p.level === 'society' ? 'location' : p.level,
          character: p.description,
          evidence: p.evidence,
          confidence: p.present ? 'high' : 'absent',
        })),
      };
    }
    
    // Continue with L3 evaluation
    const griefContext = JSON.stringify(response.griefMatrix, null, 2);
    
    const l3Completion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL3EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L2!.score, griefContext) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    try {
      const l3Match = l3Completion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (l3Match) {
        const parsed = JSON.parse(l3Match[0]);
        
        if (Array.isArray(parsed.evaluations)) {
          parsed.evaluations.forEach((eval_: { id: string; status: string; evidence?: string; functionalRole?: string }) => {
            const item = response.checklist.find(i => i.id === eval_.id);
            if (item && item.status === 'PENDING') {
              item.status = eval_.status as ChecklistItem['status'];
              item.evidence = eval_.evidence;
              item.functionalRole = eval_.functionalRole;
            }
          });
        }
        
        response.gateResults.L3 = evaluateGate(response.checklist, 'L3', mediaType);
      }
    } catch {
      response.gateResults.L3 = {
        level: 'L3',
        score: 0,
        passed: false,
        applicableItems: 0,
        passedItems: 0,
        failedItems: 0,
        insufficientDataItems: 0,
        fixList: [],
      };
    }
    
    // GATE CHECK: L3 HALT CONDITION
    if (!response.gateResults.L3?.passed) {
      response.halted = true;
      response.haltReason = `L3 gate failed with score ${response.gateResults.L3?.score}%`;
      response.success = false;
      response.error = response.haltReason;
      return NextResponse.json(response);
    }
    
    // ========================================================================
    // STEP 8: L4 EVALUATION
    // ========================================================================
    
    response.phase = 'L4_evaluation';
    
    const l4Completion = await llm.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL4EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L3!.score) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    try {
      const l4Match = l4Completion.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
      if (l4Match) {
        const parsed = JSON.parse(l4Match[0]);
        
        if (Array.isArray(parsed.evaluations)) {
          parsed.evaluations.forEach((eval_: { id: string; status: string; evidence?: string; functionalRole?: string }) => {
            const item = response.checklist.find(i => i.id === eval_.id);
            if (item && item.status === 'PENDING') {
              item.status = eval_.status as ChecklistItem['status'];
              item.evidence = eval_.evidence;
              item.functionalRole = eval_.functionalRole;
            }
          });
        }
        
        response.gateResults.L4 = evaluateGate(response.checklist, 'L4', mediaType);
      }
    } catch {
      response.gateResults.L4 = {
        level: 'L4',
        score: 0,
        passed: false,
        applicableItems: 0,
        passedItems: 0,
        failedItems: 0,
        insufficientDataItems: 0,
        fixList: [],
      };
    }
    
    // ========================================================================
    // STEP 9: CULT POTENTIAL EVALUATION (T1.4)
    // ========================================================================
    
    // Run two-phase cult potential evaluation
    const cultInput: CultEvaluationInput = {
      hasRootTrauma: !!response.skeleton?.rootTrauma,
      rootTraumaDepth: response.skeletonValidation?.elements.find(e => e.id === 'root_trauma')?.weaknessTest.passed ? 0.8 : 0.3,
      ideologicalSystem: true,
      hasThematicLaw: !!response.skeleton?.thematicLaw,
      thematicLawIntegration: response.skeletonValidation?.elements.find(e => e.id === 'thematic_law')?.weaknessTest.passed ? 0.8 : 0.3,
      themeUniversality: true,
      characterComplexity: response.gateResults.L2?.score ? response.gateResults.L2.score / 100 : 0.5,
      moralAmbiguity: response.auditMode !== 'conflict',
      worldConsistency: response.gateResults.L1?.score ? response.gateResults.L1.score / 100 : 0.5,
      transformativePotential: response.gateResults.L4?.passed || false,
      ritualizableElements: true,
      communalExperience: true,
      interpretiveDepth: 0.7,
      rewatchValue: true,
      memeticPotential: true,
    };
    
    response.cultPotential = evaluateCultPotential(cultInput);
    
    // ========================================================================
    // STEP 10: WHAT-FOR CHAIN ANALYSIS (T1.6)
    // ========================================================================
    
    // Run what-for chain on critical elements
    if (response.skeleton?.thematicLaw) {
      const chainResult = runWhatForChain(response.skeleton.thematicLaw, narrative);
      response.whatForChains.push(chainResult);
      
      // Generate issue if chain breaks early
      if (chainResult.terminal_type === 'BREAK' && chainResult.step_reached <= 4) {
        const issue = createIssue({
          id: `ISSUE-CHAIN-1`,
          location: '§thematic_law',
          severity: 'critical',
          axes: { criticality: 9, risk: 7, time_cost: 5 },
          diagnosis: `Thematic law breaks at step ${chainResult.step_reached}. Action: ${chainResult.action}`,
          patches: generatePatchTemplates('thematic_law_weak', narrative.slice(0, 100)),
        });
        response.issues.push(issue);
      }
    }
    
    // ========================================================================
    // STEP 11: GENERATE FINAL REPORT
    // ========================================================================
    
    response.phase = 'complete';
    
    const overallScore = calculateOverallScore(response.checklist);
    
    // Sort issues by priority
    response.issues = sortIssuesByPriority(response.issues);
    
    const priorityActions: [string, string, string] = [
      response.issues[0]?.diagnosis || 'Review audit findings',
      response.issues[1]?.diagnosis || 'Address critical issues',
      response.issues[2]?.diagnosis || 'Complete narrative revision',
    ];
    
    response.report = {
      humanReadable: {
        auditMode: response.auditMode || 'conflict',
        authorProfile: response.authorProfile || {
          type: 'hybrid',
          percentage: 50,
          confidence: 'low',
          mainRisks: [],
          auditPriorities: [],
        },
        skeleton: response.skeleton!,
        screening: response.screeningResult!,
        gates: response.gateResults,
        scores: {
          connectedness: Math.round((response.gateResults.L1?.score || 0) / 20),
          vitality: Math.round((response.gateResults.L2?.score || 0) / 20),
          characters: Math.round((response.gateResults.L2?.score || 0) / 20),
          theme: Math.round((response.gateResults.L1?.score || 0) / 20),
          embodiment: Math.round((response.gateResults.L3?.score || 0) / 20),
        },
        criticalHoles: response.issues.slice(0, 5).map(i => ({
          id: i.id,
          type: 'motivation' as const,
          description: i.diagnosis,
          severity: i.severity,
          suggestedFix: i.recommended,
        })),
        griefArchitecture: response.griefMatrix!,
        cultPotential: response.cultPotential?.phase2Result?.score || 0,
        finalScore: overallScore.score,
        finalPercentage: overallScore.percentage,
        classification: overallScore.classification,
        priorityActions,
      },
      jsonData: {
        audit_meta: {
          mode: response.auditMode || 'conflict',
          media_type: mediaType,
          applicable_items: overallScore.applicable,
        },
        author_profile: {
          type: response.authorProfile?.type || 'hybrid',
          percentage: response.authorProfile?.percentage || 50,
          confidence: response.authorProfile?.confidence || 'low',
        },
        skeleton: {
          thematic_law: response.skeleton?.thematicLaw || null,
          root_trauma: response.skeleton?.rootTrauma || null,
          hamartia: response.skeleton?.hamartia || null,
          dominant_grief_stage: response.skeleton?.emotionalEngine || null,
        },
        gate_results: {
          L1_score: `${response.gateResults.L1?.score || 0}%`,
          L1_passed: response.gateResults.L1?.passed || false,
          L2_score: `${response.gateResults.L2?.score || 0}%`,
          L2_passed: response.gateResults.L2?.passed || false,
          L3_score: `${response.gateResults.L3?.score || 0}%`,
          L3_passed: response.gateResults.L3?.passed || false,
          L4_score: `${response.gateResults.L4?.score || 0}%`,
        },
        overall_score: {
          checklist: `${overallScore.score}/${overallScore.applicable}`,
          percentage: `${overallScore.percentage}%`,
          classification: overallScore.classification,
        },
        critical_issues: response.issues.slice(0, 5).map(i => ({
          id: i.id,
          level: 'L1' as const,
          severity: i.severity,
          narrative_justification: i.diagnosis,
        })),
        priority_actions: priorityActions,
      },
    };
    
    // Add processing time
    const processingTime = Date.now() - startTime;
    console.log(`Audit completed in ${processingTime}ms`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze narrative', 
        details: error instanceof Error ? error.message : 'Unknown error',
        phase: 'failed',
      },
      { status: 500 }
    );
  }
}
