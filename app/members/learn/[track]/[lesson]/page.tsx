import { notFound } from "next/navigation";
import { getTrack, getLesson, TRACKS } from "@/data/learn";
import QuizPlayer from "@/components/learn/QuizPlayer";

export function generateStaticParams() {
  return TRACKS.flatMap((t) => t.lessons.map((l) => ({ track: t.id, lesson: l.id })));
}

export function generateMetadata({ params }: { params: { track: string; lesson: string } }) {
  const l = getLesson(params.track, params.lesson);
  return { title: l ? `${l.title} · HWS Investment Club` : "Lesson" };
}

export default function LessonPage({ params }: { params: { track: string; lesson: string } }) {
  const track = getTrack(params.track);
  const lesson = getLesson(params.track, params.lesson);
  if (!track || !lesson) notFound();
  return <QuizPlayer track={track} lesson={lesson} />;
}
