'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Heart, Scale, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type { GenerativeOutput, GriefMappingResult, DilemmaResult } from '@/lib/audit/types';

interface GenerativeOutputProps {
  output: GenerativeOutput | undefined | null;
}

const GRIEF_STAGE_INFO: Record<string, { description: string; color: string }> = {
  denial: {
    description: 'Refusal to accept reality',
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  },
  anger: {
    description: 'Frustration and emotional outburst',
    color: 'bg-red-500/10 border-red-500/30 text-red-600',
  },
  bargaining: {
    description: 'Attempting to negotiate or delay',
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
  },
  depression: {
    description: 'Deep sadness and withdrawal',
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
  },
  acceptance: {
    description: 'Coming to terms with reality',
    color: 'bg-green-500/10 border-green-500/30 text-green-600',
  },
};

function GriefMappingCard({ mapping }: { mapping: GriefMappingResult }) {
  const stageInfo = GRIEF_STAGE_INFO[mapping.derived_stage] || GRIEF_STAGE_INFO.depression;
  const justification = mapping.justification_chain || mapping.justification || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-pink-500" />
          §9 — Law → Grief Stage Derivation
        </CardTitle>
        <CardDescription>
          Automatically derived from thematic law when dominant_stage not provided
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Source Law */}
        {mapping.law && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Source Law</div>
            <div className="text-sm font-medium">{mapping.law}</div>
          </div>
        )}

        {/* Derived Stage */}
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">Derived Stage:</div>
          <Badge className={stageInfo.color}>
            {mapping.derived_stage.toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{stageInfo.description}</p>

        {/* Justification Chain */}
        {justification.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Justification Chain</div>
            <div className="space-y-2">
              {justification.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 text-sm bg-muted/30 p-2 rounded">
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DilemmaCard({ dilemma }: { dilemma: DilemmaResult }) {
  const criteria = dilemma.criteria_met || {};
  const allCriteriaMet = Object.values(criteria).every(Boolean);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-4 w-4 text-amber-500" />
          §12 — Theme → Dilemma Derivation
        </CardTitle>
        <CardDescription>
          Automatically derived from thematic law when final_dilemma not provided
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Values in Conflict */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <div className="text-xs text-muted-foreground mb-1">Value A</div>
            <div className="text-sm font-medium">{dilemma.value_A}</div>
          </div>
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <div className="text-xs text-muted-foreground mb-1">Value B</div>
            <div className="text-sm font-medium">{dilemma.value_B}</div>
          </div>
        </div>

        {/* Conflict Description */}
        {(dilemma.conflict_description || dilemma.post_final_world) && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Conflict</div>
            <div className="text-sm">{dilemma.conflict_description || dilemma.post_final_world}</div>
          </div>
        )}

        {/* Criteria Met */}
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            Dilemma Criteria
            {allCriteriaMet ? (
              <Badge variant="default" className="bg-green-500">All Met</Badge>
            ) : (
              <Badge variant="destructive">Incomplete</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`flex items-center gap-2 p-2 rounded ${criteria.type_choice ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {criteria.type_choice ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Type Choice</span>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${criteria.irreversibility ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {criteria.irreversibility ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Irreversibility</span>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${criteria.identity ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {criteria.identity ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Identity Impact</span>
            </div>
            <div className={`flex items-center gap-2 p-2 rounded ${criteria.victory_price ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {criteria.victory_price ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">Victory Price</span>
            </div>
          </div>
        </div>

        {/* Post-Final World */}
        {dilemma.post_final_world && !dilemma.conflict_description && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">Post-Final World</div>
            <div className="text-sm">{dilemma.post_final_world}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GenerativeOutputDisplay({ output }: GenerativeOutputProps) {
  if (!output || (!output.grief_mapping && !output.dilemma)) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">No Generative Output</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Generative modules activate automatically when required inputs are absent.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                §9 activates when dominant_stage is not provided.<br />
                §12 activates when final_dilemma is not provided.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <span className="font-medium">Generative Output</span>
        </div>
        {output.grief_mapping && (
          <Badge variant="outline">
            <Heart className="h-3 w-3 mr-1" />
            Grief Mapping
          </Badge>
        )}
        {output.dilemma && (
          <Badge variant="outline">
            <Scale className="h-3 w-3 mr-1" />
            Dilemma
          </Badge>
        )}
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-600">Auto-Generated Values</p>
            <p className="text-xs text-muted-foreground mt-1">
              These values were automatically derived because the corresponding inputs were not provided.
              You can override them by supplying explicit values in the audit input.
            </p>
          </div>
        </div>
      </div>

      {/* Grief Mapping */}
      {output.grief_mapping && (
        <GriefMappingCard mapping={output.grief_mapping} />
      )}

      {/* Dilemma */}
      {output.dilemma && (
        <DilemmaCard dilemma={output.dilemma} />
      )}
    </div>
  );
}

export default GenerativeOutputDisplay;
