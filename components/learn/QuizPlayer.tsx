"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { X, Check, ArrowRight, RotateCcw } from "lucide-react";
import type { Track, Lesson, Question } from "@/data/learn";
import { recordLesson } from "@/lib/progress";

type Phase = { i: number; picked: number | null; checked: boolean };

export default function QuizPlayer({ track, lesson }: { track: Track; lesson: Lesson }) {
  const router = useRouter();
  const questions = lesson.questions;
  const [phase, setPhase] = useState<Phase>({ i: 0, picked: null, checked: false });
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[phase.i];
  const choices = useMemo(() => optionsFor(q), [q]);
  const correctIndex = answerIndex(q);

  function check() {
    if (phase.picked === null) return;
    const right = phase.picked === correctIndex;
    if (right) setCorrect((c) => c + 1);
    setPhase((p) => ({ ...p, checked: true }));
  }

  function next() {
    if (phase.i + 1 >= questions.length) {
      recordLesson(track.id, lesson.id, correct, questions.length);
      setFinished(true);
    } else {
      setPhase({ i: phase.i + 1, picked: null, checked: false });
    }
  }

  if (finished) {
    return <Results track={track} lesson={lesson} correct={correct} total={questions.length} onRetry={() => { setPhase({ i: 0, picked: null, checked: false }); setCorrect(0); setFinished(false); }} />;
  }

  const progress = (phase.i / questions.length) * 100;
  const isRight = phase.checked && phase.picked === correctIndex;

  return (
    <main className="container-x" style={{ maxWidth: 620, margin: "0 auto", padding: "clamp(20px,3vh,32px) 0 40px", minHeight: "calc(100vh - 68px)", display: "flex", flexDirection: "column" }}>
      {/* Top bar: quit + progress */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}>
        <button onClick={() => router.push(`/members/learn/${track.id}`)} aria-label="Quit" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)", display: "inline-flex" }}>
          <X size={22} />
        </button>
        <div style={{ flex: 1, height: 12, background: "var(--card2)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "var(--brandSolid)", borderRadius: 99, transition: "width .3s" }} />
        </div>
        <span className="mono nums" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          {phase.i + 1}/{questions.length}
        </span>
      </div>

      <p className="kicker" style={{ marginBottom: 10 }}>{track.title}</p>
      <h1 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: "var(--text)", lineHeight: 1.3, letterSpacing: "-0.01em", marginBottom: 26 }}>
        {q.q}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {choices.map((label, idx) => {
          let style: React.CSSProperties = {};
          if (phase.checked) {
            if (idx === correctIndex) style = { borderColor: "var(--green)", background: "rgba(63,190,123,0.10)" };
            else if (idx === phase.picked) style = { borderColor: "var(--down)", background: "rgba(240,88,91,0.10)" };
          } else if (idx === phase.picked) {
            style = { borderColor: "var(--brandSolid)", background: "var(--card2)" };
          }
          return (
            <button
              key={idx}
              className="quiz-choice"
              disabled={phase.checked}
              onClick={() => setPhase((p) => ({ ...p, picked: idx }))}
              style={style}
            >
              <span style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${idx === phase.picked || (phase.checked && idx === correctIndex) ? "transparent" : "var(--line)"}`,
                background: phase.checked && idx === correctIndex ? "var(--green)" : phase.checked && idx === phase.picked ? "var(--down)" : idx === phase.picked ? "var(--brandSolid)" : "transparent",
                color: (idx === phase.picked) || (phase.checked && idx === correctIndex) ? "#fff" : "var(--muted)",
              }}>
                {phase.checked && idx === correctIndex ? <Check size={15} strokeWidth={3} /> : String.fromCharCode(65 + idx)}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {phase.checked && (
        <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 12, border: `1px solid ${isRight ? "var(--green)" : "var(--down)"}`, background: isRight ? "rgba(63,190,123,0.08)" : "rgba(240,88,91,0.08)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: isRight ? "var(--green)" : "var(--down)", marginBottom: 4 }}>
            {isRight ? "Correct" : "Not quite"}
          </div>
          <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55, margin: 0 }}>{q.explain}</p>
        </div>
      )}

      {/* Action */}
      <div style={{ marginTop: "auto", paddingTop: 26 }}>
        {!phase.checked ? (
          <button onClick={check} disabled={phase.picked === null} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "15px", fontSize: 16, opacity: phase.picked === null ? 0.5 : 1, cursor: phase.picked === null ? "default" : "pointer" }}>
            Check
          </button>
        ) : (
          <button onClick={next} className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "15px", fontSize: 16 }}>
            {phase.i + 1 >= questions.length ? "Finish" : "Continue"} <ArrowRight size={18} />
          </button>
        )}
      </div>
    </main>
  );
}

function Results({ track, lesson, correct, total, onRetry }: { track: Track; lesson: Lesson; correct: number; total: number; onRetry: () => void }) {
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= 80;
  return (
    <main className="container-x" style={{ maxWidth: 520, margin: "0 auto", padding: "clamp(48px,9vh,96px) 0", textAlign: "center" }}>
      <div style={{ width: 96, height: 96, borderRadius: 99, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", background: passed ? "var(--brandSolid)" : "var(--card2)", border: passed ? "none" : "1px solid var(--line)" }}>
        <span className="mono" style={{ fontSize: 30, fontWeight: 800, color: passed ? "#fff" : "var(--muted)" }}>{pct}%</span>
      </div>
      <p className="kicker">{track.title}</p>
      <h1 className="h-sub" style={{ fontSize: 28, marginTop: 6 }}>
        {passed ? "Lesson complete" : "Keep practicing"}
      </h1>
      <p className="lede" style={{ marginTop: 10 }}>
        You answered <strong style={{ color: "var(--text)" }}>{correct} of {total}</strong> correctly
        {passed ? "." : ". Review the explanations and try again to lock it in."}
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 30, flexWrap: "wrap" }}>
        <button onClick={onRetry} className="ctl" style={{ padding: "12px 18px", fontSize: 14 }}>
          <RotateCcw size={15} /> Try again
        </button>
        <Link href={`/members/learn/${track.id}`} className="btn-primary" style={{ padding: "12px 20px", fontSize: 14 }}>
          Back to {track.title.length > 16 ? "track" : track.title} <ArrowRight size={16} />
        </Link>
      </div>
    </main>
  );
}

// Normalize MC and TF questions into a common choice list + answer index.
function optionsFor(q: Question): string[] {
  return q.type === "tf" ? ["True", "False"] : q.choices;
}
function answerIndex(q: Question): number {
  return q.type === "tf" ? (q.answer ? 0 : 1) : q.answer;
}
