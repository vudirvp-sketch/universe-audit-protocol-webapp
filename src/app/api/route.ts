/**
 * UNIVERSE AUDIT PROTOCOL v10.0 - Full Audit Analysis API
 * 
 * CRITICAL: This route now uses the orchestrator for ALL audit logic.
 * 
 * NON-NEGOTIABLE RULES IMPLEMENTED:
 * - RULE_5: If any gate fails: STOP. Output fixes for that level ONLY
 * - RULE_8: Gate output includes block-level breakdown
 * - RULE_9: ISSUE objects have full schema with axes and patches
 * - RULE_10: Generative templates activate automatically
 */

import { NextRequest, NextResponse } from 'next/server';
import runFullAudit, { 
  type AuditInput, 
  type AuditState,
  type AuditPhase 
} from '@/lib/audit/orchestrator';
import { getLLMClient, type LLMProvider } from '@/lib/llm-client';
import type { MediaType } from '@/lib/audit/media-transformation';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

interface AnalyzeRequest {
  narrative: string;
  mediaType: MediaType;
  authorAnswers?: {
    Q1: boolean;
    Q2: boolean;
    Q3: boolean;
    Q4: boolean;
    Q5: boolean;
    Q6: boolean;
    Q7: boolean;
  };
  provider?: LLMProvider | null;
  apiKey?: string | null;
  model?: string | null;
  dominant_stage?: string;
  final_dilemma?: string;
}

interface AnalyzeResponse {
  status: 'complete' | 'blocked' | 'error';
  audit_meta?: {
    protocol_version: string;
    audit_mode: string;
    media_type: MediaType;
    author_profile: {
      type: string;
      priority_override: string[];
    };
  };
  gating?: {
    L1: unknown;
    L2: unknown;
    L3: unknown;
    L4: unknown;
  };
  skeleton?: unknown;
  grief_architecture?: {
    dominant_stage: string;
    validation: unknown;
  };
  cult_potential?: unknown;
  issues?: unknown[];
  generative_output?: unknown;
  protocol_limitations?: string[];
  what_for_chains?: unknown[];
  final_score?: {
    total: string;
    percentage: number;
    by_level: Record<string, number>;
  };
  next_actions?: unknown[];
  error?: string;
  reason?: string;
  fixes?: string[];
}

// ============================================================================
// MAIN POST HANDLER
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
    
    // Basic validation
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

    // Set LLM context if provided
    if (provider && apiKey) {
      process.env.LLM_PROVIDER = provider;
      process.env.LLM_API_KEY = apiKey;
      if (model) process.env.LLM_MODEL = model;
    }
    
    // === RUN FULL AUDIT ===
    // This replaces all previous logic - orchestrator handles everything
    const auditInput: AuditInput = {
      concept: narrative,
      media_type: mediaType,
      author_answers: authorAnswers,
      dominant_stage,
      final_dilemma
    };

    const result: AuditState = await runFullAudit(auditInput);

    // === HANDLE BLOCKED STATE ===
    if (result.phase === 'blocked') {
      const response: AnalyzeResponse = {
        status: 'blocked',
        reason: result.error,
        fixes: result.issues.map(i => i.diagnosis),
        skeleton: result.skeleton ? {
          status: result.skeleton.overallStatus,
          elements: result.skeleton.elements,
          blockers: result.skeleton.blockers
        } : undefined,
        issues: result.issues
      };
      
      return NextResponse.json(response, { status: 400 });
    }

    // === HANDLE COMPLETE STATE ===
    const response: AnalyzeResponse = {
      status: 'complete',
      audit_meta: {
        protocol_version: '10.0',
        audit_mode: result.audit_mode_config?.mode || 'conflict',
        media_type: mediaType,
        author_profile: {
          type: result.author_profile_result?.type || 'hybrid',
          priority_override: result.author_profile_result?.priority_array || []
        }
      },
      gating: {
        L1: result.gate_L1 ? formatGateResult(result.gate_L1) : null,
        L2: result.gate_L2 ? formatGateResult(result.gate_L2) : null,
        L3: result.gate_L3 ? formatGateResult(result.gate_L3) : null,
        L4: result.gate_L4 ? formatGateResult(result.gate_L4) : null
      },
      skeleton: result.skeleton ? {
        status: result.skeleton.overallStatus,
        elements: result.skeleton.elements,
        weaknesses: result.skeleton.weaknesses
      } : undefined,
      grief_architecture: {
        dominant_stage: result.generative_output?.grief_mapping?.derived_stage || 
                        dominant_stage || 
                        'depression',
        validation: result.grief_validation
      },
      cult_potential: result.cult_potential ? {
        passed: result.cult_potential.passed,
        classification: result.cult_potential.classification,
        phase1: result.cult_potential.phase1Result,
        phase2: result.cult_potential.phase2Result,
        recommendations: result.cult_potential.recommendations
      } : undefined,
      issues: result.issues.map(formatIssue),
      generative_output: result.generative_output,
      what_for_chains: result.what_for_chains,
      final_score: result.final_score,
      next_actions: result.next_actions,
      protocol_limitations: [] // Would be populated by diagnostics
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

interface GateResultData {
  gateId: string;
  gateName: string;
  status: string;
  score: number;
  conditions: Array<{ id: string; passed: boolean; message: string }>;
  halt: boolean;
  fixes: string[];
  metadata: Record<string, unknown>;
}

/**
 * Formats gate result with RULE_8 compliant block-level breakdown
 */
function formatGateResult(gate: GateResultData): {
  gate: string;
  score: number;
  passed: boolean;
  status: string;
  breakdown: Record<string, string>;
  fixes?: string[];
  halt: boolean;
} {
  // RULE_8: Include block-level breakdown, never just aggregate %
  const breakdown: Record<string, string> = {};
  
  if (gate.metadata?.breakdown && typeof gate.metadata.breakdown === 'object') {
    Object.assign(breakdown, gate.metadata.breakdown);
  } else {
    // Build breakdown from conditions
    for (const condition of gate.conditions) {
      breakdown[condition.id] = condition.passed ? 'PASS' : 'FAIL';
    }
  }

  return {
    gate: gate.gateId,
    score: Math.round(gate.score),
    passed: gate.status === 'passed',
    status: gate.status,
    breakdown, // RULE_8: Block-level breakdown always included
    fixes: gate.fixes.length > 0 ? gate.fixes : undefined,
    halt: gate.halt
  };
}

interface IssueData {
  id: string;
  location: string;
  severity: string;
  axes: { criticality: number; risk: number; time_cost: number };
  diagnosis: string;
  patches: {
    conservative: { description: string };
    compromise: { description: string };
    radical: { description: string };
  };
  recommended: string;
  reasoning: string;
}

/**
 * Formats issue with RULE_9 compliant full schema
 */
function formatIssue(issue: IssueData): {
  id: string;
  location: string;
  severity: string;
  axes: { criticality: number; risk: number; time_cost: number };
  diagnosis: string;
  patches: {
    conservative: { description: string };
    compromise: { description: string };
    radical: { description: string };
  };
  recommended: string;
  reasoning: string;
} {
  // RULE_9: All fields must be present
  return {
    id: issue.id,
    location: issue.location,
    severity: issue.severity,
    axes: issue.axes,
    diagnosis: issue.diagnosis,
    patches: issue.patches,
    recommended: issue.recommended,
    reasoning: issue.reasoning
  };
}
