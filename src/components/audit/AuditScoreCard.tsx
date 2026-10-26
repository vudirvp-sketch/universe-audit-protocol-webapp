'use client';

/**
 * AuditScoreCard — qualitative verdict card (v16 §26.S).
 *
 * Replaces the legacy numeric score card: no percentages, no circular
 * progress, no arbitrary score totals. Renders the seven qualitative bands,
 * confidence, root-issue / recommendation counts and the capability frontier (§22).
 */

import * as React from 'react';
import type {
  AuditVerdict,
  CapabilityFrontierCounts,
  MediaType,
  VerdictBand,
} from '@/lib/audit/types-v3';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/ru';
import {
  bandSeverity,
  bandValueLabel,
  confidenceSeverity,
  formatCount,
  severityChipClass,
  severityTextClass,
} from '@/lib/audit/verdict-display';

// ============================================================
// Band label & media label
// ============================================================

function bandLabel(band: VerdictBand): string {
  return t.verdict.bands[band.key] ?? band.label;
}

function mediaLabel(mediaType: MediaType): string {
  switch (mediaType) {
    case 'narrative':
      return t.form.mediaNarrative;
    case 'game':
      return t.form.mediaGame;
    case 'visual':
      return t.form.mediaVisual;
    default:
      return t.form.mediaTtrpg;
  }
}

// ============================================================
// Frontier breakdown — v16 §22
// ============================================================

const FRONTIER_KEYS = [
  'demonstrated',
  'under_proven',
  'latent',
  'new_primitive_required',
  'experimental',
  'deferred',
  'contradicted_or_should_not_add',
] as const;

function FrontierBreakdown({ frontier }: { frontier: CapabilityFrontierCounts }) {
  return (
    <div className="border-t pt-3">
      <h3 className="text-sm font-medium mb-2">{t.verdict.frontier}</h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {FRONTIER_KEYS.map((key) => {
          const count = frontier[key];
          return (
            <li key={key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className={cn(count > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {t.verdict.frontierLabels[key]}
              </span>
              <span
                className={cn(
                  'font-mono tabular-nums',
                  count > 0 ? 'text-foreground' : 'text-muted-foreground/60',
                )}
              >
                {count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ============================================================
// Props
// ============================================================

export interface AuditVerdictCardProps {
  verdict: AuditVerdict;
  mediaType?: MediaType;
}

// ============================================================
// Main component
// ============================================================

export function AuditVerdictCard({ verdict, mediaType }: AuditVerdictCardProps) {
  const overall = verdict.bands.find((band) => band.key === 'overall_state') ?? null;
  const otherBands = verdict.bands.filter((band) => band.key !== 'overall_state');
  const confidence = verdict.confidence;

  return (
    <section
      aria-labelledby="verdict-card-title"
      className="border-2 rounded-lg p-6 mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 id="verdict-card-title" className="text-base font-semibold">
          {t.verdict.title}
        </h2>
        <div className="flex items-center gap-2">
          {mediaType && (
            <span className="text-sm text-muted-foreground">{mediaLabel(mediaType)}</span>
          )}
          <Badge variant="outline" className="text-xs">
            {verdict.source === 'json' ? t.verdict.sourceJson : t.verdict.sourceMarkdown}
          </Badge>
        </div>
      </div>

      {verdict.bands.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.verdict.fallback}</p>
      ) : (
        <>
          {/* Overall state — headline */}
          {overall && (
            <div className="mb-4">
              <p className="text-sm text-muted-foreground">{t.verdict.bands.overall_state}</p>
              <p
                className={cn('text-2xl font-bold', severityTextClass(bandSeverity(overall)))}
              >
                {bandValueLabel(overall.value)}
              </p>
            </div>
          )}

          {/* Remaining bands as labelled value chips */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {otherBands.map((band) => {
              const severity = bandSeverity(band);
              return (
                <div
                  key={band.key}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <dt className="text-sm text-muted-foreground">{bandLabel(band)}</dt>
                  <dd className="m-0">
                    <span
                      className={cn(
                        'inline-block rounded-md px-2 py-0.5 text-sm font-medium',
                        severityChipClass(severity),
                      )}
                    >
                      {bandValueLabel(band.value)}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>

          {/* Confidence + counts */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {confidence && (
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{t.verdict.confidence}:</span>
                <span
                  className={cn(
                    'font-medium',
                    severityTextClass(confidenceSeverity(confidence)),
                  )}
                >
                  {bandValueLabel(confidence)}
                </span>
              </span>
            )}
            <span className="text-muted-foreground">
              {formatCount(verdict.issues.length, t.verdict.counts.problems)}
            </span>
            <span className="text-muted-foreground">
              {formatCount(verdict.recommendations.length, t.verdict.counts.recommendations)}
            </span>
          </div>
        </>
      )}

      {/* Capability frontier — v16 §22 */}
      {verdict.frontier && (
        <div className="mt-4">
          <FrontierBreakdown frontier={verdict.frontier} />
        </div>
      )}

      {/* Closing statement — required by §26.S */}
      {verdict.closingStatement && (
        <blockquote className="mt-4 border-l-4 border-severity-recommendation pl-3 text-sm italic text-muted-foreground">
          {verdict.closingStatement}
        </blockquote>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{t.verdict.docs}</p>
    </section>
  );
}
