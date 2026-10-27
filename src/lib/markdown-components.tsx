'use client';

import * as React from 'react';
import { CalloutBlock } from '@/components/audit/CalloutBlock';
import { t } from '@/lib/i18n/ru';

/**
 * Extract plain text content from React children (for callout detection).
 */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (!children) return '';
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode };
    if (props.children) return extractTextFromChildren(props.children);
  }
  return '';
}

/**
 * Remove the [!TYPE] prefix from children by stripping the matched text
 * from the first text-containing child.
 */
function removeCalloutPrefix(children: React.ReactNode, prefixLength: number): React.ReactNode {
  let remaining = prefixLength;
  const strip = (node: React.ReactNode): React.ReactNode => {
    if (remaining <= 0) return node;
    if (typeof node === 'string') {
      const stripped = node.slice(remaining);
      remaining = 0;
      return stripped;
    }
    if (Array.isArray(node)) {
      return node.map(strip);
    }
    if (React.isValidElement(node)) {
      const props = node.props as { children?: React.ReactNode };
      if (props.children) {
        return React.cloneElement(node, {} as Record<string, unknown>, strip(props.children));
      }
    }
    return node;
  };
  return strip(children);
}

/**
 * Shared ReactMarkdown components override object.
 * - blockquote: renders GitHub-style callout blocks ([!NOTE], [!WARNING], etc.)
 * - pre: styled code block containers; the machine-readable §27 JSON block is
 *   collapsed behind a summary (it is for programme consumption, and a 1 000 px
 *   single-line JSON inside a 816 px reading column forces horizontal scrolling)
 * - code: inline code styling
 */

/** The §27 machine block always carries the verdict object. */
const MACHINE_JSON_MARKER = 'final_verdict';

export const markdownComponents = {
  blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'> & { node?: unknown }) => {
    const textContent = extractTextFromChildren(children);
    const calloutMatch = textContent.match(/^\[!(NOTE|WARNING|TIP|CAUTION|CRITICAL)\]\s*/i);

    if (calloutMatch) {
      const type = calloutMatch[1].toUpperCase();
      const remainingChildren = removeCalloutPrefix(children, calloutMatch[0].length);
      return <CalloutBlock type={type}>{remainingChildren}</CalloutBlock>;
    }

    return <blockquote {...props}>{children}</blockquote>;
  },

  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => {
    const textContent = extractTextFromChildren(children);

    if (textContent.includes(MACHINE_JSON_MARKER)) {
      return (
        <details className="my-6 rounded-sm border border-border bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {t.report.machineBlock}
          </summary>
          <pre
            className="mt-3 max-h-96 overflow-auto font-mono text-xs leading-relaxed"
            {...props}
          >
            {children}
          </pre>
        </details>
      );
    }

    return (
      <pre className="rounded-sm border border-border bg-card p-4 overflow-x-auto text-sm" {...props}>
        {children}
      </pre>
    );
  },

  code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
    // If className contains a language (e.g., "language-tsx"), it's a fenced code block
    const isInline = !className;
    if (isInline) {
      return <code className="bg-muted px-1.5 py-0.5 rounded-sm text-[0.9em] font-mono" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
};
