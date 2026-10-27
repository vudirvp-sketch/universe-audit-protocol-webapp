'use client';

/**
 * useStickToBottom — follow a growing document without hijacking the reader.
 *
 * The old behaviour called `scrollIntoView` on every streamed delta, so the
 * page could not be scrolled up while the model was writing: every token pulled
 * the viewport back to the bottom. This hook follows the bottom only while the
 * reader is already there. Scrolling up detaches the follow; scrolling back to
 * the bottom — or calling `jumpToLatest` — re-attaches it.
 *
 * The follow is a plain `window.scrollTo`, issued once per committed update.
 * No smooth behaviour and no animation frame: a pending `requestAnimationFrame`
 * is not guaranteed to run (background tabs and automated browser windows
 * throttle it), and a stalled frame used to freeze the follow entirely.
 */

import * as React from 'react';

/** How close to the bottom still counts as "the reader is following along". */
const FOLLOW_THRESHOLD_PX = 96;

function scrollingElement(): Element {
  return document.scrollingElement ?? document.documentElement;
}

function distanceFromBottom(): number {
  const element = scrollingElement();
  return element.scrollHeight - window.scrollY - window.innerHeight;
}

function scrollToBottom(): void {
  const element = scrollingElement();
  window.scrollTo(0, element.scrollHeight);
}

export interface StickToBottom {
  /** True while the viewport follows new text. */
  following: boolean;
  /** Re-attach the follow and jump to the newest text. */
  jumpToLatest: () => void;
}

/**
 * @param active  Follow only while a run is streaming.
 * @param revision Any value that changes when new text is appended (length is enough).
 */
export function useStickToBottom(active: boolean, revision: number): StickToBottom {
  const [following, setFollowing] = React.useState(true);
  const followingRef = React.useRef(true);

  const updateFollowing = React.useCallback((next: boolean) => {
    if (followingRef.current === next) return;
    followingRef.current = next;
    setFollowing(next);
  }, []);

  // The reader's position is the source of truth: a manual scroll up detaches,
  // a scroll back to the bottom re-attaches.
  React.useEffect(() => {
    const onScroll = () => {
      updateFollowing(distanceFromBottom() <= FOLLOW_THRESHOLD_PX);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [updateFollowing]);

  // A new run starts a new document: follow it even if the previous read ended
  // with the reader scrolled up in the old report.
  React.useEffect(() => {
    if (active) updateFollowing(true);
  }, [active, updateFollowing]);

  // The effect runs after the new text is committed, so the scroll targets the
  // real height of the document. Several deltas batched into one store update
  // cost exactly one scroll.
  React.useEffect(() => {
    if (!active || !followingRef.current) return;
    scrollToBottom();
  }, [active, revision]);

  const jumpToLatest = React.useCallback(() => {
    updateFollowing(true);
    scrollToBottom();
  }, [updateFollowing]);

  return { following, jumpToLatest };
}
