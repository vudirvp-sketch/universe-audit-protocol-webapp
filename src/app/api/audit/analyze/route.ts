/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Full Audit Analysis API
 * 
 * REFACTORED: Now uses the central orchestrator for ALL audit logic.
 * 
 * NON-NEGOTIABLE RULES IMPLEMENTED:
 * - RULE_2: "А чтобы что?" chain terminal classified as BREAK/DILEMMA
 * - RULE_3: Cult Potential mandatory criteria are BLOCKING
 * - RULE_4: Media adaptation transforms prompts via map
 * - RULE_5: Gate failure: STOP, output fixes for that level ONLY
 * - RULE_8: Gate output includes block-level breakdown
 * - RULE_9: ISSUE objects have full schema with axes and patches
 * - RULE_10: Generative templates activate automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import runFullAudit, { 
  type AuditInput, 
  type AuditState,
  type AuthorProfileAnswers 
} from '@/lib/audit/orchestrator';
import type { MediaType, AuditMode, AuthorProfile } from '@/lib/audit/types';
import { getLLMClient, type LLMProvider } from '@/lib/llm-client';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface AnalyzeRequest {
  narrative: string;
  mediaType: MediaType;
  authorAnswers?: AuthorProfileAnswers;
  provider?: LLMProvider | null;
  apiKey?: string | null;
  model?: string | null;
  dominant_stage?: string;
  final_dilemma?: string;
}

interface AnalyzeResponse {
  success: boolean;
  status: 'complete' | 'blocked' | 'error';
  auditMode: AuditMode | null;
  authorProfile: AuthorProfile | null;
  phase?: string;
  error?: string;
  
  // Orchestrator results
  validation_result?: {
    valid: boolean;
    errors?: Array<{ field: string; message: string }>;
  };
  skeleton?: AuditState['skeleton'];
  screening_result?: AuditState['screening_result'];
  gateResults?: {
    L1: AuditState['gate_L1'];
    L2: AuditState['gate_L2'];
    L3: AuditState['gate_L3'];
    L4: AuditState['gate_L4'];
  };
  grief_validation?: AuditState['grief_validation'];
  cult_potential?: AuditState['cult_potential'];
  issues?: AuditState['issues'];
  what_for_chains?: AuditState['what_for_chains'];
  generative_output?: AuditState['generative_output'];
  diagnostics?: AuditState['diagnostics'];
  final_score?: AuditState['final_score'];
  next_actions?: AuditState['next_actions'];
  
  // Legacy compatibility
  report?: {
    humanReadable: {
      auditMode: AuditMode;
      authorProfile: AuthorProfile;
      skeleton: AuditState['skeleton'];
      screening: AuditState['screening_result'];
      gates: {
        L1: AuditState['gate_L1'];
        L2: AuditState['gate_L2'];
        L3: AuditState['gate_L3'];
        L4: AuditState['gate_L4'];
      };
      finalScore: number;
      finalPercentage: number;
      priorityActions: [string, string, string];
    };
  };
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AnalyzeRequest;
    const { 
      narrative, 
      mediaType, 
      authorAnswers, 
      provider, 
      apiKey, 
      model,
      dominant_stage,
      final_dilemma
    } = body;
    
    // === INPUT VALIDATION ===
    if (!narrative || typeof narrative !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          status: 'error',
          error: 'Narrative text is required' 
        },
        { status: 400 }
      );
    }
    
    if (!mediaType) {
      return NextResponse.json(
        { 
          success: false, 
          status: 'error',
          error: 'Media type is required' 
        },
        { status: 400 }
      );
    }

    // === SET LLM CONTEXT (if provided) ===
    if (provider && apiKey) {
      process.env.LLM_PROVIDER = provider;
      process.env.LLM_API_KEY = apiKey;
      if (model) process.env.LLM_MODEL = model;
    }

    // === CONSTRUCT AUDIT INPUT ===
    const auditInput: AuditInput = {
      concept: narrative,
      media_type: mediaType || 'novel',
      author_answers: authorAnswers,
      dominant_stage,
      final_dilemma
    };

    // === RUN FULL AUDIT VIA ORCHESTRATOR ===
    // This is the MAIN FIX - route.ts now uses orchestrator
    const result: AuditState = await runFullAudit(auditInput);

    // === HANDLE BLOCKED STATE ===
    if (result.phase === 'blocked') {
      return NextResponse.json({
        success: false,
        status: 'blocked',
        phase: result.phase,
        error: result.error,
        auditMode: result.audit_mode_config?.mode || null,
        authorProfile: result.author_profile_result ? {
          type: result.author_profile_result.type,
          percentage: result.author_profile_result.percentage,
          confidence: result.author_profile_result.confidence,
          mainRisks: result.author_profile_result.risk_flags,
          auditPriorities: result.author_profile_result.priority_array,
        } : null,
        validation_result: result.validation_result ? {
          valid: result.validation_result.valid,
          errors: result.validation_result.errors
        } : undefined,
        skeleton: result.skeleton,
        screening_result: result.screening_result,
        grief_validation: result.grief_validation,
        cult_potential: result.cult_potential,
        issues: result.issues,
      }, { status: 400 });
    }

    // === BUILD SUCCESS RESPONSE ===
    const response: AnalyzeResponse = {
      success: true,
      status: 'complete',
      phase: result.phase,
      auditMode: result.audit_mode_config?.mode || null,
      authorProfile: result.author_profile_result ? {
        type: result.author_profile_result.type,
        percentage: result.author_profile_result.percentage,
        confidence: result.author_profile_result.confidence,
        mainRisks: result.author_profile_result.risk_flags,
        auditPriorities: result.author_profile_result.priority_array,
      } : null,
      skeleton: result.skeleton,
      screening_result: result.screening_result,
      gateResults: {
        L1: result.gate_L1,
        L2: result.gate_L2,
        L3: result.gate_L3,
        L4: result.gate_L4,
      },
      grief_validation: result.grief_validation,
      cult_potential: result.cult_potential,
      issues: result.issues,
      what_for_chains: result.what_for_chains,
      generative_output: result.generative_output,
      diagnostics: result.diagnostics,
      final_score: result.final_score,
      next_actions: result.next_actions,
    };

    // === LEGACY COMPATIBILITY: Build report ===
    if (result.final_score) {
      response.report = {
        humanReadable: {
          auditMode: result.audit_mode_config?.mode || 'conflict',
          authorProfile: result.author_profile_result ? {
            type: result.author_profile_result.type,
            percentage: result.author_profile_result.percentage,
            confidence: result.author_profile_result.confidence,
            mainRisks: result.author_profile_result.risk_flags,
            auditPriorities: result.author_profile_result.priority_array,
          } : {
            type: 'hybrid',
            percentage: 50,
            confidence: 'low',
            mainRisks: [],
            auditPriorities: [],
          },
          skeleton: result.skeleton,
          screening: result.screening_result,
          gates: {
            L1: result.gate_L1,
            L2: result.gate_L2,
            L3: result.gate_L3,
            L4: result.gate_L4,
          },
          finalScore: result.final_score.percentage,
          finalPercentage: result.final_score.percentage,
          priorityActions: [
            result.next_actions[0]?.action || 'Review audit findings',
            result.next_actions[1]?.action || 'Address critical issues',
            result.next_actions[2]?.action || 'Complete narrative revision',
          ] as [string, string, string],
        },
      };
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Audit analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        status: 'error',
        error: 'Failed to analyze narrative', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
