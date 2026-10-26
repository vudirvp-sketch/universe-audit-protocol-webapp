'use client';

/**
 * AuditScoreCard — qualitative verdict card (v16 §26.S).
 *
 * Replaces the legacy numeric score card: no percentages, no circular
 * progress, no arbitrary score totals. Renders the seven qualitative bands,
 * confidence, root-issue / recommendation counts and the capability frontier (§22).
 *
 * Direction A: the verdict is a document section, not a box — hairline rows,
 * severity carried by `SeverityMark` shape plus one text token, no chips.
 */

import * as React from 'react';
import type {
  AuditVerdict,
  CapabilityFrontierCounts,
  MediaType,
  VerdictBand,
} from '@/lib/audit/types-v3';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n/ru';
import { SeverityMark } from './status-marks';
import {
  bandSeverity,
  bandValueLabel,
  confidenceSeverity,
  formatCount,
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
    <div className="py-3">
      <h3 className="text-sm font-medium">{t.verdict.frontier}</h3>
      <ul className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {FRONTIER_KEYS.map((key) => {
          const count = frontier[key];
          return (
            <li key={key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className={count > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                {t.verdict.frontierLabels[key]}
              </span>
              <span
                className={cn(
                  'tabular-nums',
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
  const confidenceTone = confidenceSeverity(confidence);
  const sourceLabel =
    verdict.source === 'json' ? t.verdict.sourceJson : t.verdict.sourceMarkdown;

  return (
    <section aria-labelledby="verdict-card-title" className="mb-10">
      {/* Title row + provenance, hairline underneath */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3">
        <h2 id="verdict-card-title" className="text-base font-semibold">
          {t.verdict.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {mediaType ? `${mediaLabel(mediaType)} · ` : null}
          {sourceLabel}
        </p>
      </div>

      {verdict.bands.length === 0 ? (
        <p className="border-b border-border py-3 text-sm text-muted-foreground">
          {t.verdict.fallback}
        </p>
      ) : (
        <>
          {/* Overall state — the one headline row */}
          {overall && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-4">
              <span className="flex items-baseline gap-2">
                <SeverityMark severity={bandSeverity(overall)} />
                <span className="text-sm text-muted-foreground">{bandLabel(overall)}</span>
              </span>
              <span
                className={cn('text-xl font-semibold', severityTextClass(bandSeverity(overall)))}
              >
                {bandValueLabel(overall.value)}
              </span>
            </div>
          )}

          {/* Remaining bands — document rows, value in severity colour + mark */}
          <dl className="border-b border-border">
            {otherBands.map((band) => {
              const severity = bandSeverity(band);
              return (
                <div
                  key={band.key}
                  className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0"
                >
                  <dt className="text-sm text-muted-foreground">{bandLabel(band)}</dt>
                  <dd className="m-0 flex items-baseline gap-2 text-sm">
                    <SeverityMark severity={severity} size="sm" />
                    <span className={cn('font-medium', severityTextClass(severity))}>
                      {bandValueLabel(band.value)}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>

          {/* Confidence + counts, same rhythm */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-border py-3 text-sm">
            {confidence && (
              <span className="flex items-baseline gap-2">
                <SeverityMark severity={confidenceTone} size="sm" />
                <span className="text-muted-foreground">{t.verdict.confidence}:</span>
                <span className={cn('font-medium', severityTextClass(confidenceTone))}>
                  {bandValueLabel(confidence)}
                </span>
              </span>
            )}
            <span className="tabular-nums text-muted-foreground">
              {formatCount(verdict.issues.length, t.verdict.counts.problems)}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatCount(verdict.recommendations.length, t.verdict.counts.recommendations)}
            </span>
          </div>
        </>
      )}

      {/* Capability frontier — v16 §22 */}
      {verdict.frontier && (
        <div className="border-b border-border">
          <FrontierBreakdown frontier={verdict.frontier} />
        </div>
      )}

      {/* Closing statement — required by §26.S */}
      {verdict.closingStatement && (
        <div className="border-b border-border py-4">
          <blockquote className="m-0 border-l-2 border-border pl-4">
            <p className="text-sm text-muted-foreground">{t.verdict.closing}</p>
            <p className="mt-1 text-base text-foreground">{verdict.closingStatement}</p>
          </blockquote>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">{t.verdict.docs}</p>
    </section>
  );
}
