"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

export function GallerySearch({ initialQuery = "", category, autoFocus = false, placeholder, buttonLabel }: { initialQuery?: string; category?: string; autoFocus?: boolean; placeholder: string; buttonLabel: string }) {
  const router = useRouter();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") || "").trim();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    router.push(params.size ? `/?${params.toString()}` : "/", { scroll: false });
  }

  return (
    <form className="gallery-search" role="search" onSubmit={search}>
      <label className="sr-only" htmlFor="gallery-query">{placeholder}</label>
      <input id="gallery-query" name="q" defaultValue={initialQuery} placeholder={placeholder} autoFocus={autoFocus} maxLength={80} />
      <button className="ghost" type="submit">{buttonLabel}</button>
    </form>
  );
}
