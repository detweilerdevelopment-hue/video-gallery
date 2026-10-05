import Link from "next/link";
import type { VideoDocument } from "@/lib/types";
import { storageUrl } from "@/lib/storage";

function duration(value?: number) {
  if (!value) return null;
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function cardDescription(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 150 ? `${normalized.slice(0, 147).trimEnd()}...` : normalized;
}

export function VideoCard({ video, category }: { video: VideoDocument; category?: string }) {
  const posterSrc = video.poster?.key ? storageUrl(video.poster.key) : null;
  return (
    <article className="video-card">
      <Link href={`/videos/${video.slug}`} aria-label={`Watch ${video.title}`}>
        <div className="thumb">
          {posterSrc ? (
            <img src={posterSrc} alt="" loading="lazy" decoding="async" />
          ) : <div className="poster-placeholder" aria-hidden="true" />}
          <span className="play" aria-hidden="true">▶</span>
          {duration(video.media?.durationSeconds) && <span className="duration">{duration(video.media?.durationSeconds)}</span>}
        </div>
        <div className="card-body">
          <div className="eyebrow">{category || "Video"}</div>
          <h3>{video.title}</h3>
          <p>{cardDescription(video.description)}</p>
          <div className="meta"><span>{video.viewCount.toLocaleString()} views</span><span>Cloud video</span></div>
        </div>
      </Link>
    </article>
  );
}
