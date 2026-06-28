// Client-side learning progress, stored per-device in localStorage.
// No accounts needed — fits the shared-password login. When HWS SSO lands we
// can sync this shape to a server keyed by student id.

export type Progress = {
  xp: number;
  streak: number;
  lastActive: string; // YYYY-MM-DD of last completed lesson
  completed: string[]; // "trackId/lessonId"
  best: Record<string, number>; // "trackId/lessonId" -> best % (0-100)
};

const KEY = "hws-learn-v1";

const empty: Progress = { xp: 0, streak: 0, lastActive: "", completed: [], best: {} };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return Infinity;
  const da = new Date(a + "T00:00:00");
  const db = new Date(b + "T00:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

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

// Lessons unlock sequentially: the first is always open, later ones unlock
// once the previous lesson in the track is complete.
export function isUnlocked(
  p: Progress,
  trackId: string,
  lessonIds: string[],
  index: number
): boolean {
  if (index === 0) return true;
  return p.completed.includes(lessonKey(trackId, lessonIds[index - 1]));
}

// Record a finished lesson. Awards XP (10 per correct), updates the daily
// streak, and stores the best score. Returns the updated progress.
export function recordLesson(
  trackId: string,
  lessonId: string,
  correct: number,
  total: number
): Progress {
  const p = loadProgress();
  const key = lessonKey(trackId, lessonId);
  const pct = total ? Math.round((correct / total) * 100) : 0;

  const firstTime = !p.completed.includes(key);
  if (firstTime) p.completed.push(key);
  p.best[key] = Math.max(p.best[key] ?? 0, pct);

  // XP: full value first time, quarter value for replays.
  p.xp += firstTime ? correct * 10 : Math.round(correct * 2.5);

  // Streak update (only advances once per calendar day).
  const today = todayStr();
  if (p.lastActive !== today) {
    const gap = daysBetween(p.lastActive, today);
    p.streak = gap === 1 ? p.streak + 1 : 1;
    p.lastActive = today;
  } else if (p.streak === 0) {
    p.streak = 1;
  }

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

export function level(xp: number): number {
  // 100 XP per level, starting at level 1.
  return Math.floor(xp / 100) + 1;
}
