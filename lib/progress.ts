// Client-side study progress, stored per-device in localStorage.
// Intentionally minimal — this is a study tool, not a game. We only remember
// which lessons a member has completed (for a quiet "reviewed" check) and their
// best score on each (for self-assessment). No points, streaks, or levels.

export type Progress = {
  completed: string[]; // "trackId/lessonId"
  best: Record<string, number>; // "trackId/lessonId" -> best % (0-100)
};

const KEY = "hws-learn-v2";
const empty: Progress = { completed: [], best: {} };

export function loadProgress(): Progress {
  if (typeof window === "undefined") return { ...empty };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return { ...empty };
  }
}

function save(p: Progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / private mode */
  }
}

export function lessonKey(trackId: string, lessonId: string): string {
  return `${trackId}/${lessonId}`;
}

export function isComplete(p: Progress, trackId: string, lessonId: string): boolean {
  return p.completed.includes(lessonKey(trackId, lessonId));
}

// Record a finished lesson: mark complete and store the best score.
export function recordLesson(
  trackId: string,
  lessonId: string,
  correct: number,
  total: number
): Progress {
  const p = loadProgress();
  const key = lessonKey(trackId, lessonId);
  const pct = total ? Math.round((correct / total) * 100) : 0;
  if (!p.completed.includes(key)) p.completed.push(key);
  p.best[key] = Math.max(p.best[key] ?? 0, pct);
  save(p);
  return p;
}

export function trackCompletion(
  p: Progress,
  trackId: string,
  lessonIds: string[]
): { done: number; total: number } {
  const done = lessonIds.filter((id) => p.completed.includes(lessonKey(trackId, id))).length;
  return { done, total: lessonIds.length };
}
