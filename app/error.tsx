"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("Gallery route failed", error);
  }, [error]);

  return (
    <main className="center-page">
      <div className="eyebrow">Temporary problem</div>
      <h1>We could not load the gallery.</h1>
      <p>Please try again. If the problem continues, contact the site owner.</p>
      {error.digest && <p><small>Error reference: {error.digest}</small></p>}
      <div className="inline-actions">
        <button className="btn" onClick={retry}>Try again</button>
        <button className="ghost" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </main>
  );
}
