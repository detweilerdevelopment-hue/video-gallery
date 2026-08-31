import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoForm } from "@/components/admin/video-form";
import { getCategories, getVideoById } from "@/lib/repositories";

export default async function EditVideoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params;
  const [{ error, success }, video, categories] = await Promise.all([searchParams, getVideoById(id), getCategories(true)]);
  if (!video?._id) notFound();
  return <><div className="admin-heading"><div><Link className="back-link" href="/admin/videos">← Videos</Link><div className="eyebrow">{video.status}</div><h1>Edit video</h1></div><div className="inline-actions">{video.status === "published" && <Link className="ghost" href={`/videos/${video.slug}`} target="_blank">View live ↗</Link>}</div></div>{success === "saved" && <div className="flash-success">Changes saved.</div>}{success === "published" && <div className="flash-success">Video saved and published.</div>}{error === "media-required" && <div className="flash-error">Upload a video file before publishing.</div>}{error === "storage-verification" && <div className="flash-error">The uploaded file could not be found in Backblaze. Upload it again and wait for completion.</div>}{error === "validation" && <div className="flash-error">Check the form and try again.</div>}<VideoForm video={video} categories={categories} /></>;
}
