import type { CategoryDocument, VideoDocument } from "@/lib/types";
import { BackblazeUpload } from "./backblaze-upload";
import { saveVideoAction } from "@/app/admin/actions";
import { storageUrl } from "@/lib/storage";
import { MediaSubmitActions } from "./media-submit-actions";

function assetJson(asset?: VideoDocument["videoAsset"] | VideoDocument["poster"]) {
  return asset ? JSON.stringify({ ...asset, url: storageUrl(asset.key) }) : "";
}

export function VideoForm({ video, categories }: { video?: VideoDocument; categories: CategoryDocument[] }) {
  return (
    <form className="admin-form" action={saveVideoAction}>
      {video?._id && <input type="hidden" name="id" value={video._id.toHexString()} />}
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="title">Title</label><input className="form-control" id="title" name="title" defaultValue={video?.title} required minLength={2} maxLength={120} /></div>
        <div className="form-group"><label htmlFor="categoryId">Category</label><select className="form-control" id="categoryId" name="categoryId" defaultValue={video?.categoryId?.toHexString() || ""}><option value="">No category</option>{categories.map((category) => <option value={category._id?.toHexString()} key={category._id?.toHexString()}>{category.name}{!category.isActive ? " (inactive)" : ""}</option>)}</select></div>
        <div className="form-group full"><label htmlFor="description">Description</label><textarea className="form-control" id="description" name="description" defaultValue={video?.description} required minLength={5} maxLength={5000} /><small>Cards automatically shorten long descriptions with an ellipsis.</small></div>
        <div className="form-group"><label htmlFor="tags">Tags</label><input className="form-control" id="tags" name="tags" defaultValue={video?.tags.join(", ")} placeholder="film, interview, coast" /><small>Comma-separated.</small></div>
        <div className="form-group"><label htmlFor="sortOrder">Sort order</label><input className="form-control" id="sortOrder" name="sortOrder" type="number" min="0" defaultValue={video?.sortOrder ?? 0} /></div>
        <div className="form-group full"><label className="checkbox"><input name="featured" type="checkbox" defaultChecked={video?.featured} /> Feature this video</label></div>
        <div className="form-group full"><BackblazeUpload kind="video" inputName="assetJson" initialJson={assetJson(video?.videoAsset)} label={video?.videoAsset ? "Replace video file" : "Upload video file"} /></div>
        <div className="form-group full"><BackblazeUpload kind="image" inputName="posterJson" initialJson={assetJson(video?.poster)} label="Poster image" /></div>
      </div>
      <MediaSubmitActions isExisting={Boolean(video)} isPublished={video?.status === "published"} />
    </form>
  );
}
