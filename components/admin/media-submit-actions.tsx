"use client";

import { useState } from "react";

export function MediaSubmitActions({ isExisting, isPublished }: { isExisting: boolean; isPublished: boolean }) {
  const [message, setMessage] = useState("");

  function requireVideo(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form) return;
    const videoJson = String(new FormData(form).get("assetJson") || "");
    if (!videoJson) {
      event.preventDefault();
      setMessage("Choose a video and wait until the upload reaches 100% before publishing.");
    }
  }

  return (
    <div className="form-actions">
      <button className="ghost" type="submit" name="intent" value="save">{isExisting ? "Save changes" : "Save draft"}</button>
      {!isPublished && <button className="btn" type="submit" name="intent" value="publish" onClick={requireVideo}>Save &amp; publish</button>}
      <span className="subtle">Uploaded media is attached when you save or publish.</span>
      {message && <span className="form-inline-error" role="alert">{message}</span>}
    </div>
  );
}
