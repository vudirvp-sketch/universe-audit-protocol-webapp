'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Link2, CheckCircle2, XCircle, ArrowRight, HelpCircle } from 'lucide-react';
import type { ChainResult, ChainIteration } from '@/lib/audit/types';
import { t } from '@/lib/i18n/ru';

interface WhatForChainsProps {
  chains: ChainResult[];
}

const TERMINAL_COLORS = {
  BREAK: 'bg-red-500/10 border-red-500/30 text-red-600',
  DILEMMA: 'bg-green-500/10 border-green-500/30 text-green-600',
  UNCLASSIFIED: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
};

const ACTION_COLORS = {
  bind_to_law: 'bg-blue-500/10 border-blue-500/30 text-blue-600',
  keep: 'bg-green-500/10 border-green-500/30 text-green-600',
  remove: 'bg-red-500/10 border-red-500/30 text-red-600',
  bind_to_law_or_remove: 'bg-purple-500/10 border-purple-500/30 text-purple-600',
  retry_analysis: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600',
};

function ChainIterationCard({ iteration, isLast }: { iteration: ChainIteration; isLast: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isLast ? 'bg-primary text-primary-foreground' : 'bg-muted'
        }`}>
          {iteration.step}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-border mt-1" />}
      </div>
      <div className="flex-1 pb-4">
        <div className="text-sm font-medium text-muted-foreground mb-1">
          {iteration.question}
        </div>
        <div className="text-sm bg-muted/50 p-2 rounded">
          {iteration.answer}
        </div>
        {iteration.analysis && (
          <div className="text-xs text-muted-foreground mt-1 italic">
            {iteration.analysis}
          </div>
        )}
      </div>
    </div>
  );
}

function ChainCard({ chain, index }: { chain: ChainResult; index: number }) {
  const terminal = chain.terminal || chain.terminal_type || 'UNCLASSIFIED';
  const stepReached = chain.terminalStep || chain.step_reached;
  const iterations = chain.chain || chain.iterations || [];

  // Determine if this is a critical BREAK (step <= 4)
  const isCriticalBreak = terminal === 'BREAK' && stepReached <= 4;

  return (
    <Card className={`border ${isCriticalBreak ? 'border-red-500/50' : 'border-border'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            {t.chains.chainTitle.replace('{index}', String(index + 1))}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={TERMINAL_COLORS[terminal as keyof typeof TERMINAL_COLORS] || TERMINAL_COLORS.UNCLASSIFIED}>
              {terminal}
            </Badge>
            {chain.action && (
              <Badge className={ACTION_COLORS[chain.action as keyof typeof ACTION_COLORS] || ''}>
                {t.chains.actionLabels[chain.action as keyof typeof t.chains.actionLabels] || chain.action.replace('_', ' ')}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Critical Warning */}
        {isCriticalBreak && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-600">
                {t.chains.criticalBreak.replace('{step}', String(stepReached))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t.chains.criticalBreakDesc}
              </p>
            </div>
          </div>
        )}

        {/* Validity Status */}
        <div className="flex items-center gap-2">
          {chain.valid ? (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">{t.chains.validChain}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-600">
              <HelpCircle className="h-4 w-4" />
              <span className="text-sm">{t.chains.unclassifiedTerminal}</span>
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {'\u2022'} {t.chains.terminatedAtStep.replace('{step}', String(stepReached))}
          </span>
        </div>

        {/* Iterations */}
        {iterations.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-sm font-medium">{t.chains.iterations}</h4>
            <div className="pl-2">
              {iterations.map((iteration, i) => (
                <ChainIterationCard
                  key={i}
                  iteration={iteration}
                  isLast={i === iterations.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reasoning */}
        {chain.reasoning && (
          <div className="text-xs text-muted-foreground italic p-2 bg-muted/50 rounded">
            {chain.reasoning}
          </div>
        )}

        {/* Action Recommendation */}
        {chain.action && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="text-sm font-medium mb-1">{t.chains.recommendedAction}</div>
            <div className="flex items-center gap-2">
              {chain.action === 'bind_to_law' && (
                <>
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{t.chains.bindToLaw}</span>
                </>
              )}
              {chain.action === 'keep' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">{t.chains.keepElement}</span>
                </>
              )}
              {chain.action === 'remove' && (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">{t.chains.removeElement}</span>
                </>
              )}
              {chain.action === 'bind_to_law_or_remove' && (
                <>
                  <AlertTriangle className="h-4 w-4 text-purple-500" />
                  <span className="text-sm">{t.chains.bindOrRemove}</span>
                </>
              )}
              {chain.action === 'retry_analysis' && (
                <>
                  <HelpCircle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{t.chains.retryAnalysis}</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WhatForChains({ chains }: WhatForChainsProps) {
  if (!chains || chains.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">{t.chains.noChains}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t.chains.noChainsDesc}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Separate by terminal type
  const breaks = chains.filter(c => c.terminal === 'BREAK' || c.terminal_type === 'BREAK');
  const dilemmas = chains.filter(c => c.terminal === 'DILEMMA' || c.terminal_type === 'DILEMMA');
  const unclassified = chains.filter(c => !c.terminal && !c.terminal_type);

  // Count critical breaks (step <= 4)
  const criticalBreaks = breaks.filter(c =>
    (c.terminalStep || c.step_reached) <= 4
  );

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          <span className="font-medium">{t.chains.countChains.replace('{count}', String(chains.length))}</span>
        </div>
        {breaks.length > 0 && (
          <Badge variant="destructive">{t.chains.breakCount.replace('{count}', String(breaks.length))}</Badge>
        )}
        {dilemmas.length > 0 && (
          <Badge variant="default" className="bg-green-500">{t.chains.dilemmaCount.replace('{count}', String(dilemmas.length))}</Badge>
        )}
        {unclassified.length > 0 && (
          <Badge variant="secondary">{t.chains.unclassifiedCount.replace('{count}', String(unclassified.length))}</Badge>
        )}
        {criticalBreaks.length > 0 && (
          <Badge variant="destructive" className="animate-pulse">
            {t.chains.criticalCount.replace('{count}', String(criticalBreaks.length))}
          </Badge>
        )}
      </div>

      {/* Critical BREAK Chains (step <= 4) */}
      {criticalBreaks.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            {t.chains.criticalBreakChains}
          </h3>
          <div className="space-y-4">
            {criticalBreaks.map((chain, i) => (
              <ChainCard key={i} chain={chain} index={chains.indexOf(chain)} />
            ))}
          </div>
        </div>
      )}

      {/* Other BREAK Chains */}
      {breaks.filter(c => (c.terminalStep || c.step_reached) > 4).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-orange-500">
            <XCircle className="h-5 w-5" />
            {t.chains.otherBreakChains}
          </h3>
          <div className="space-y-4">
            {breaks.filter(c => (c.terminalStep || c.step_reached) > 4).map((chain, i) => (
              <ChainCard key={i} chain={chain} index={chains.indexOf(chain)} />
            ))}
          </div>
        </div>
      )}

      {/* DILEMMA Chains */}
      {dilemmas.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            {t.chains.dilemmaChains}
          </h3>
          <div className="space-y-4">
            {dilemmas.map((chain, i) => (
              <ChainCard key={i} chain={chain} index={chains.indexOf(chain)} />
            ))}
          </div>
        </div>
      )}

      {/* Unclassified Chains */}
      {unclassified.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-yellow-500">
            <HelpCircle className="h-5 w-5" />
            {t.chains.unclassifiedChains}
          </h3>
          <div className="space-y-4">
            {unclassified.map((chain, i) => (
              <ChainCard key={i} chain={chain} index={chains.indexOf(chain)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatForChains;
