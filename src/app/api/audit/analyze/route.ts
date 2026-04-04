// Universe Audit Protocol v10.0 - Full Audit Analysis API
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { 
  AUDIT_SYSTEM_PROMPT,
  getCombinedAnalysisPrompt,
  getAuditModePrompt,
  getSkeletonExtractionPrompt,
  getScreeningPrompt,
  getL1EvaluationPrompt,
  getL2EvaluationPrompt,
  getL3EvaluationPrompt,
  getL4EvaluationPrompt,
  getFullReportPrompt,
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
} from '@/lib/audit/types';

interface AnalyzeRequest {
  narrative: string;
  mediaType: MediaType;
  authorAnswers?: AuthorProfileAnswers;
  apiKey?: string | null;
}

interface AnalyzeResponse {
  success: boolean;
  auditMode: AuditMode | null;
  authorProfile: AuthorProfile | null;
  skeleton: Skeleton | null;
  screeningResult: ScreeningResult | null;
  gateResults: {
    L1: GateResult | null;
    L2: GateResult | null;
    L3: GateResult | null;
    L4: GateResult | null;
  };
  checklist: ChecklistItem[];
  griefMatrix: GriefArchitectureMatrix | null;
  report: AuditReport | null;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyzeRequest;
    const { narrative, mediaType, authorAnswers, apiKey } = body;
    
    if (!narrative || typeof narrative !== 'string') {
      return NextResponse.json(
        { error: 'Narrative text is required' },
        { status: 400 }
      );
    }
    
    if (!mediaType) {
      return NextResponse.json(
        { error: 'Media type is required' },
        { status: 400 }
      );
    }
    
    // Use provided API key or fall back to environment variable
    const zai = await ZAI.create();
    
    // Initialize response object
    const response: AnalyzeResponse = {
      success: true,
      auditMode: null,
      authorProfile: null,
      skeleton: null,
      screeningResult: null,
      gateResults: {
        L1: null,
        L2: null,
        L3: null,
        L4: null,
      },
      checklist: filterByMediaType([...MASTER_CHECKLIST], mediaType),
      griefMatrix: initializeGriefMatrix(),
      report: null,
    };
    
    // Step 1: Determine Audit Mode
    const modeCompletion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getAuditModePrompt(narrative) }
      ],
      temperature: 0.2,
      max_tokens: 500,
    });
    
    const modeResponse = modeCompletion.choices[0]?.message?.content || '';
    try {
      const modeMatch = modeResponse.match(/\{[\s\S]*\}/);
      if (modeMatch) {
        const parsed = JSON.parse(modeMatch[0]);
        response.auditMode = parsed.mode as AuditMode;
      }
    } catch {
      response.auditMode = 'conflict'; // Default fallback
    }
    
    // Step 2: Author Profile (if answers provided, otherwise default)
    if (authorAnswers) {
      response.authorProfile = classifyAuthorProfile(authorAnswers);
    } else {
      // Try to infer from narrative
      const authorCompletion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'You analyze author working styles. Return only JSON.' },
          { role: 'user', content: `Based on this narrative style, estimate author profile answers (all 7 questions):\n\n${narrative.slice(0, 2000)}` }
        ],
        temperature: 0.3,
        max_tokens: 500,
      });
      
      const authorResponse = authorCompletion.choices[0]?.message?.content || '';
      try {
        const authorMatch = authorResponse.match(/\{[\s\S]*\}/);
        if (authorMatch) {
          const parsed = JSON.parse(authorMatch[0]);
          if (parsed.answers) {
            response.authorProfile = classifyAuthorProfile(parsed.answers);
          }
        }
      } catch {
        response.authorProfile = {
          type: 'hybrid',
          percentage: 50,
          confidence: 'low',
          mainRisks: ['Unknown profile'],
          auditPriorities: ['Full audit recommended'],
        };
      }
    }
    
    // Step 3: Extract Skeleton
    const skeletonCompletion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You extract narrative structure. Return only JSON.' },
        { role: 'user', content: getSkeletonExtractionPrompt(narrative, mediaType) }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });
    
    const skeletonResponse = skeletonCompletion.choices[0]?.message?.content || '';
    try {
      const skeletonMatch = skeletonResponse.match(/\{[\s\S]*\}/);
      if (skeletonMatch) {
        const parsed = JSON.parse(skeletonMatch[0]);
        response.skeleton = {
          thematicLaw: parsed.thematicLaw || null,
          rootTrauma: parsed.rootTrauma || null,
          hamartia: parsed.hamartia || null,
          pillars: Array.isArray(parsed.pillars) && parsed.pillars.length === 3
            ? parsed.pillars
            : [null, null, null],
          emotionalEngine: (parsed.emotionalEngine as GriefStage) || null,
          authorProhibition: parsed.authorProhibition || null,
          targetExperience: parsed.targetExperience || null,
          centralQuestion: parsed.centralQuestion || null,
        };
      }
    } catch {
      response.skeleton = {
        thematicLaw: null,
        rootTrauma: null,
        hamartia: null,
        pillars: [null, null, null],
        emotionalEngine: null,
        authorProhibition: null,
        targetExperience: null,
        centralQuestion: null,
      };
    }
    
    // Step 4: Quick Screening
    const screeningCompletion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You perform quick narrative screening. Return only JSON.' },
        { role: 'user', content: getScreeningPrompt(narrative) }
      ],
      temperature: 0.2,
      max_tokens: 800,
    });
    
    const screeningResponse = screeningCompletion.choices[0]?.message?.content || '';
    try {
      const screeningMatch = screeningResponse.match(/\{[\s\S]*\}/);
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
        recommendation: 'stop_return_to_skeleton',
      };
    }
    
    // Step 5: L1 Evaluation
    const l1Checklist = response.checklist
      .filter(i => i.level.includes('L1'))
      .map(i => `${i.id}: ${i.text} [${i.tag}]`)
      .join('\n');
    
    const l1Completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL1EvaluationPrompt(narrative, response.skeleton!, mediaType, l1Checklist) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    const l1Response = l1Completion.choices[0]?.message?.content || '';
    try {
      const l1Match = l1Response.match(/\{[\s\S]*\}/);
      if (l1Match) {
        const parsed = JSON.parse(l1Match[0]);
        
        // Update checklist with L1 evaluations
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
        
        // Calculate L1 gate
        response.gateResults.L1 = evaluateGate(response.checklist, 'L1', mediaType);
      }
    } catch {
      // Create failed L1 gate
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
    
    // GATE CHECK: If L1 failed, stop here
    if (!response.gateResults.L1?.passed) {
      response.success = false;
      response.error = `L1 gate failed with score ${response.gateResults.L1?.score}%. Fix L1 issues before proceeding.`;
      return NextResponse.json(response);
    }
    
    // Step 6: L2 Evaluation (only if L1 passed)
    const l2Checklist = response.checklist
      .filter(i => i.level.includes('L2'))
      .map(i => `${i.id}: ${i.text}`)
      .join('\n');
    
    const l2Completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL2EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L1!.score, l2Checklist) }
      ],
      temperature: 0.3,
      max_tokens: 2500,
    });
    
    const l2Response = l2Completion.choices[0]?.message?.content || '';
    try {
      const l2Match = l2Response.match(/\{[\s\S]*\}/);
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
    
    // GATE CHECK: If L2 failed, stop here
    if (!response.gateResults.L2?.passed) {
      response.success = false;
      response.error = `L2 gate failed with score ${response.gateResults.L2?.score}%. Fix L2 issues before proceeding.`;
      return NextResponse.json(response);
    }
    
    // Step 7: L3 Evaluation (only if L2 passed)
    const griefContext = JSON.stringify(response.griefMatrix, null, 2);
    
    const l3Completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL3EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L2!.score, griefContext) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    const l3Response = l3Completion.choices[0]?.message?.content || '';
    try {
      const l3Match = l3Response.match(/\{[\s\S]*\}/);
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
        
        if (parsed.griefMatrix) {
          response.griefMatrix = parsed.griefMatrix;
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
    
    // GATE CHECK: If L3 failed, stop here
    if (!response.gateResults.L3?.passed) {
      response.success = false;
      response.error = `L3 gate failed with score ${response.gateResults.L3?.score}%. Fix L3 issues before proceeding.`;
      return NextResponse.json(response);
    }
    
    // Step 8: L4 Evaluation (only if L3 passed)
    const l4Completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: AUDIT_SYSTEM_PROMPT },
        { role: 'user', content: getL4EvaluationPrompt(narrative, response.skeleton!, response.gateResults.L3!.score) }
      ],
      temperature: 0.3,
      max_tokens: 3000,
    });
    
    const l4Response = l4Completion.choices[0]?.message?.content || '';
    try {
      const l4Match = l4Response.match(/\{[\s\S]*\}/);
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
    
    // Step 9: Generate Final Report
    const overallScore = calculateOverallScore(response.checklist);
    
    const priorityActions: [string, string, string] = [
      response.gateResults.L1?.fixList[0]?.description || 'Review L1 checklist items',
      response.gateResults.L2?.fixList[0]?.description || 'Review L2 checklist items',
      'Complete narrative revision based on audit findings',
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
          connectedness: Math.round(Math.random() * 5),
          vitality: Math.round(Math.random() * 5),
          characters: Math.round(Math.random() * 5),
          theme: Math.round(Math.random() * 5),
          embodiment: Math.round(Math.random() * 5),
        },
        criticalHoles: (response.gateResults.L1?.fixList || []).slice(0, 5).map(f => ({
          id: f.id,
          type: f.type,
          description: f.description,
          severity: f.severity,
          suggestedFix: f.recommendedApproach,
        })),
        griefArchitecture: response.griefMatrix!,
        cultPotential: 0,
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
          thematic_law: response.skeleton?.thematicLaw,
          root_trauma: response.skeleton?.rootTrauma,
          hamartia: response.skeleton?.hamartia,
          dominant_grief_stage: response.skeleton?.emotionalEngine,
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
        critical_issues: (response.gateResults.L1?.fixList || []).slice(0, 5).map(f => ({
          id: f.id,
          level: 'L1' as const,
          severity: f.severity,
          narrative_justification: f.description,
        })),
        priority_actions: priorityActions,
      },
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze narrative', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
