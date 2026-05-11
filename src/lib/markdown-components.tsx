'use client';

import * as React from 'react';
import { CalloutBlock } from '@/components/audit/CalloutBlock';

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
 * - pre: styled code block containers
 * - code: inline code styling
 */
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

  pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
    <pre className="rounded-lg bg-muted/50 p-4 overflow-x-auto text-sm" {...props}>
      {children}
    </pre>
  ),

  code: ({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
    // If className contains a language (e.g., "language-tsx"), it's a fenced code block
    const isInline = !className;
    if (isInline) {
      return <code className="bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
};
