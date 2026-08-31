import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { GallerySearch } from "@/components/public/gallery-search";
import { VideoCard } from "@/components/public/video-card";
import { categoryMap, getCategories, getPublishedVideos, getSettings, getVideoById } from "@/lib/repositories";
import { storageUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; focus?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.page || "1", 10) || 1));
  const [settings, categories] = await Promise.all([
    getSettings(),
    getCategories(),
  ]);
  const [pageResults, selectedFeatured, fallbackFeatured] = await Promise.all([
    getPublishedVideos({ query: params.q, categorySlug: params.category, offset: (page - 1) * 24, limit: 25 }),
    settings.featuredVideoId ? getVideoById(settings.featuredVideoId.toHexString()) : Promise.resolve(null),
    getPublishedVideos({ limit: 1 }),
  ]);
  const hasNext = pageResults.length > 24;
  const videos = pageResults.slice(0, 24);
  const categoriesById = categoryMap(categories);
  const featured = selectedFeatured?.status === "published" ? selectedFeatured : fallbackFeatured[0];
  const heroSrc = settings.heroImage?.key ? storageUrl(settings.heroImage.key) : featured?.poster?.key ? storageUrl(featured.poster.key) : null;
  const heroMedia = (
    <>
      {heroSrc ? <Image src={heroSrc} alt={settings.heroImageAlt} width={1200} height={800} priority /> : <div className="hero-placeholder" />}
      {featured && settings.showFeaturedOverlay !== false && <div className="hero-overlay"><span>Featured</span><strong>{featured.title}</strong></div>}
    </>
  );

  return (
    <>
      <SiteHeader siteName={settings.siteName} />
      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <div className="eyebrow">{settings.heroEyebrow}</div>
              <h1>{settings.heroTitle}</h1>
              <p>{settings.heroDescription}</p>
            </div>
            {featured ? (
              <Link className="hero-card hero-card-link" href={`/videos/${featured.slug}`} aria-label={`Watch featured video: ${featured.title}`}>
                {heroMedia}
              </Link>
            ) : <div className="hero-card">{heroMedia}</div>}
          </div>
        </section>

        <section className="wrap section" id="gallery">
          <div className="section-head">
            <div><div className="eyebrow">{settings.galleryEyebrow}</div><h2>{settings.galleryTitle}</h2></div>
            <GallerySearch initialQuery={params.q} category={params.category} autoFocus={params.focus === "search"} placeholder={settings.gallerySearchPlaceholder} buttonLabel={settings.gallerySearchButton} />
          </div>
          <div className="filters" aria-label="Filter by category">
            <Link scroll={false} className={`filter ${!params.category ? "active" : ""}`} href={params.q ? `/?q=${encodeURIComponent(params.q)}` : "/"}>{settings.galleryAllLabel}</Link>
            {categories.map((category) => (
              <Link scroll={false} key={category._id?.toHexString()} className={`filter ${params.category === category.slug ? "active" : ""}`} href={`/?category=${category.slug}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}>
                {category.name}
              </Link>
            ))}
          </div>
          {videos.length ? (
            <><div className="video-grid">
              {videos.map((video) => <VideoCard key={video._id?.toHexString()} video={video} category={video.categoryId ? categoriesById.get(video.categoryId.toHexString())?.name : undefined} />)}
            </div><div className="pagination">{page > 1 && <Link scroll={false} className="ghost" href={`/?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.category ? { category: params.category } : {}), page: String(page - 1) })}`}>← Previous</Link>}<span>Page {page}</span>{hasNext && <Link scroll={false} className="ghost" href={`/?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.category ? { category: params.category } : {}), page: String(page + 1) })}`}>Next →</Link>}</div></>
          ) : (
            <div className="empty-state"><h3>{settings.galleryEmptyTitle}</h3><p>{settings.galleryEmptyDescription}</p><Link scroll={false} href="/">{settings.galleryClearFiltersLabel}</Link></div>
          )}
        </section>

      </main>
      <SiteFooter siteName={settings.siteName} aboutPageLabel={settings.aboutPageLabel} privacyPolicyLabel={settings.privacyPolicyLabel} />
    </>
  );
}
