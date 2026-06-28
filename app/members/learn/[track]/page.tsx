import { notFound } from "next/navigation";
import { getTrack, TRACKS } from "@/data/learn";
import TrackView from "@/components/learn/TrackView";

export function generateStaticParams() {
  return TRACKS.map((t) => ({ track: t.id }));
}

export function generateMetadata({ params }: { params: { track: string } }) {
  const t = getTrack(params.track);
  return { title: t ? `${t.title} · HWS Investment Club` : "Learn" };
}

export default function TrackPage({ params }: { params: { track: string } }) {
  const track = getTrack(params.track);
  if (!track) notFound();
  return <TrackView track={track} />;
}
