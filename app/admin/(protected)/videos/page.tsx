import Link from "next/link";
import { DeleteVideoButton } from "@/components/admin/delete-video-button";
import Image from "next/image";
import { getAllVideos, getCategories, categoryMap } from "@/lib/repositories";
import { setVideoStatusAction } from "@/app/admin/actions";
import { LocalDateTime } from "@/components/admin/local-date-time";
import { storageUrl } from "@/lib/storage";

export default async function VideosAdminPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const [{ success }, videos, categories] = await Promise.all([searchParams, getAllVideos(), getCategories(true)]);
  const categoriesById = categoryMap(categories);
  return (
    <>
      <div className="admin-heading"><div><div className="eyebrow">Library</div><h1>Videos</h1></div><Link className="btn" href="/admin/videos/new">Add video</Link></div>
      {success && <div className="flash-success">{success === "deleted" ? "Video deleted." : "Video status updated."}</div>}
      <section className="admin-panel">
        {videos.length ? <table className="admin-table"><thead><tr><th>Thumbnail</th><th>Title</th><th>Category</th><th>Sort order</th><th>Status</th><th>Views</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{videos.map((video) => { const thumbnailUrl = video.poster?.key ? storageUrl(video.poster.key) : null; return <tr key={video._id?.toHexString()}><td>{thumbnailUrl ? <Image className="admin-thumbnail" src={thumbnailUrl} width={96} height={60} alt="" /> : <div className="admin-thumbnail-placeholder" aria-label="No thumbnail" />}</td><td><Link href={`/admin/videos/${video._id?.toHexString()}/edit`}>{video.title}</Link>{video.featured && <span className="subtle"> · Featured</span>}</td><td>{video.categoryId ? categoriesById.get(video.categoryId.toHexString())?.name || "—" : "—"}</td><td>{video.sortOrder}</td><td><span className={`status status-${video.status}`}>{video.status}</span></td><td>{video.viewCount.toLocaleString()}</td><td><LocalDateTime value={new Date(video.updatedAt).toISOString()} dateOnly /></td><td><div className="inline-actions"><Link className="ghost" href={`/admin/videos/${video._id?.toHexString()}/edit`}>Edit</Link>{video.status !== "published" && video.status !== "archived" && <form className="inline-form" action={setVideoStatusAction}><input type="hidden" name="id" value={video._id?.toHexString()} /><input type="hidden" name="status" value="published" /><button className="ghost" type="submit">Publish</button></form>}{video.status === "published" && <form className="inline-form" action={setVideoStatusAction}><input type="hidden" name="id" value={video._id?.toHexString()} /><input type="hidden" name="status" value="draft" /><button className="ghost" type="submit">Unpublish</button></form>}{video.status !== "archived" && <form className="inline-form" action={setVideoStatusAction}><input type="hidden" name="id" value={video._id?.toHexString()} /><input type="hidden" name="status" value="archived" /><button className="danger-btn" type="submit">Archive</button></form>}{video.status === "archived" && <form className="inline-form" action={setVideoStatusAction}><input type="hidden" name="id" value={video._id?.toHexString()} /><input type="hidden" name="status" value="draft" /><button className="ghost" type="submit">Restore</button></form>}<DeleteVideoButton id={video._id!.toHexString()} title={video.title} /></div></td></tr>; })}</tbody></table> : <div className="empty-state"><h3>No videos yet</h3><p>Upload the first video to start the gallery.</p><Link href="/admin/videos/new">Add video</Link></div>}
      </section>
    </>
  );
}
