import Link from "next/link";
import { VideoForm } from "@/components/admin/video-form";
import { getCategories } from "@/lib/repositories";

export default async function NewVideoPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, categories] = await Promise.all([searchParams, getCategories(true)]);
  const errorMessage = error === "media-required"
    ? "Upload the video file and wait for the success message before publishing."
    : error === "storage-verification"
      ? "The uploaded file could not be found in Backblaze. Upload it again and wait for completion."
      : error
        ? "Check the title, description, and uploaded files, then try again."
        : null;
  return <><div className="admin-heading"><div><Link className="back-link" href="/admin/videos">← Videos</Link><div className="eyebrow">New draft</div><h1>Add video</h1></div></div>{errorMessage && <div className="flash-error">{errorMessage}</div>}<VideoForm categories={categories} /></>;
}
