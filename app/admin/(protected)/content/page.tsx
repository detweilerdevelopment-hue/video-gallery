import { BackblazeUpload } from "@/components/admin/backblaze-upload";
import { saveSettingsAction } from "@/app/admin/actions";
import { getAllVideos, getSettings } from "@/lib/repositories";
import { storageUrl } from "@/lib/storage";

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ success, error }, settings, videos] = await Promise.all([searchParams, getSettings(), getAllVideos()]);
  const published = videos.filter((video) => video.status === "published");
  const errorMessage = error === "hero-image"
    ? "The homepage banner could not be verified. Upload it again and retry."
    : "Check all required fields and their length limits, then try again.";
  return (
    <>
      <div className="admin-heading"><div><div className="eyebrow">Site content</div><h1>Pages</h1></div></div>
      {success && <div className="flash-success">Site content saved and public cache refreshed.</div>}
      {error && <div className="flash-error">{errorMessage}</div>}
      <form className="admin-form" action={saveSettingsAction}>
        <section className="admin-panel"><h2>Entry screen labels</h2><div className="form-grid">
          {([
            ["entryGateBadge", "Badge (optional)", 12],
            ["ageGateEyebrow", "Age screen small heading", 100],
            ["cookieGateEyebrow", "Cookie screen small heading", 100],
            ["deniedGateEyebrow", "Access unavailable small heading", 100],
            ["deniedGateTitle", "Access unavailable heading", 200],
            ["deniedGateRetryLabel", "Review answers button", 100],
          ] as const).map(([name, label, maxLength]) => <div className="form-group" key={name}><label htmlFor={name}>{label}</label><input className="form-control" id={name} name={name} defaultValue={settings[name]} required={name !== "entryGateBadge"} minLength={name === "entryGateBadge" ? 0 : 2} maxLength={maxLength} /></div>)}
          <div className="form-group full"><label htmlFor="deniedGateDescription">Access unavailable description</label><textarea className="form-control" id="deniedGateDescription" name="deniedGateDescription" defaultValue={settings.deniedGateDescription} required minLength={10} maxLength={1000} /></div>
        </div></section>
        <section className="admin-panel"><h2>Brand and hero</h2><div className="form-grid">
          <div className="form-group"><label htmlFor="siteName">Site name</label><input className="form-control" id="siteName" name="siteName" defaultValue={settings.siteName} required maxLength={60} /></div>
          <div className="form-group"><label htmlFor="heroEyebrow">Eyebrow</label><input className="form-control" id="heroEyebrow" name="heroEyebrow" defaultValue={settings.heroEyebrow} required maxLength={60} /></div>
          <div className="form-group full"><label htmlFor="heroTitle">Main heading</label><input className="form-control" id="heroTitle" name="heroTitle" defaultValue={settings.heroTitle} required maxLength={120} /></div>
          <div className="form-group full"><label htmlFor="heroDescription">Top description</label><textarea className="form-control" id="heroDescription" name="heroDescription" defaultValue={settings.heroDescription} required minLength={10} maxLength={500} /></div>
          <div className="form-group full"><BackblazeUpload kind="image" inputName="heroImageJson" initialJson={settings.heroImage ? JSON.stringify({ ...settings.heroImage, url: storageUrl(settings.heroImage.key) }) : ""} label="Banner image" /></div>
          <div className="form-group full"><label htmlFor="heroImageAlt">Banner alternative text</label><input className="form-control" id="heroImageAlt" name="heroImageAlt" defaultValue={settings.heroImageAlt} required maxLength={180} /></div>
          <div className="form-group full"><label htmlFor="featuredVideoId">Featured video</label><select className="form-control" id="featuredVideoId" name="featuredVideoId" defaultValue={settings.featuredVideoId?.toHexString() || ""}><option value="">Automatic — first video in gallery</option>{published.map((video) => <option key={video._id?.toHexString()} value={video._id?.toHexString()}>{video.title}</option>)}</select><small>Visitors open this video when they click the banner image. Automatic uses the first published video in gallery order.</small></div>
          <div className="form-group full"><label className="checkbox"><input name="showFeaturedOverlay" type="checkbox" defaultChecked={settings.showFeaturedOverlay !== false} /> Show featured text box on banner</label><small>Turn this off to show only the banner image. The banner remains linked to the featured video.</small></div>
        </div></section>
        <section className="admin-panel"><h2>Gallery text</h2><p className="subtle">These labels appear above and inside the public video gallery. German defaults are provided and can be changed at any time.</p><div className="form-grid content-settings-grid">
          <div className="form-group"><label htmlFor="galleryEyebrow">Small heading</label><input className="form-control" id="galleryEyebrow" name="galleryEyebrow" defaultValue={settings.galleryEyebrow} required minLength={2} maxLength={80} /></div>
          <div className="form-group"><label htmlFor="galleryTitle">Gallery heading</label><input className="form-control" id="galleryTitle" name="galleryTitle" defaultValue={settings.galleryTitle} required minLength={2} maxLength={100} /></div>
          <div className="form-group"><label htmlFor="gallerySearchPlaceholder">Search placeholder</label><input className="form-control" id="gallerySearchPlaceholder" name="gallerySearchPlaceholder" defaultValue={settings.gallerySearchPlaceholder} required minLength={2} maxLength={100} /></div>
          <div className="form-group"><label htmlFor="gallerySearchButton">Search button</label><input className="form-control" id="gallerySearchButton" name="gallerySearchButton" defaultValue={settings.gallerySearchButton} required minLength={2} maxLength={60} /></div>
          <div className="form-group"><label htmlFor="galleryAllLabel">All categories label</label><input className="form-control" id="galleryAllLabel" name="galleryAllLabel" defaultValue={settings.galleryAllLabel} required minLength={2} maxLength={60} /></div>
          <div className="form-group"><label htmlFor="galleryEmptyTitle">Empty gallery heading</label><input className="form-control" id="galleryEmptyTitle" name="galleryEmptyTitle" defaultValue={settings.galleryEmptyTitle} required minLength={2} maxLength={120} /></div>
          <div className="form-group full"><label htmlFor="galleryEmptyDescription">Empty gallery message</label><input className="form-control" id="galleryEmptyDescription" name="galleryEmptyDescription" defaultValue={settings.galleryEmptyDescription} required minLength={2} maxLength={240} /></div>
          <div className="form-group full"><label htmlFor="galleryClearFiltersLabel">Clear filters link</label><input className="form-control" id="galleryClearFiltersLabel" name="galleryClearFiltersLabel" defaultValue={settings.galleryClearFiltersLabel} required minLength={2} maxLength={80} /></div>
        </div></section>
        <section className="admin-panel"><h2>Visitor entry questions</h2><p className="subtle">Edit the wording shown before visitors enter the site. Ask a qualified professional to review wording required by local law. Changing the cookie question asks previously consenting visitors again.</p><div className="form-grid content-settings-grid">
          <div className="form-group full"><label htmlFor="ageGateTitle">Age question</label><input className="form-control" id="ageGateTitle" name="ageGateTitle" defaultValue={settings.ageGateTitle} required minLength={5} maxLength={200} /></div>
          <div className="form-group full"><label htmlFor="ageGateDescription">Age explanation</label><textarea className="form-control" id="ageGateDescription" name="ageGateDescription" defaultValue={settings.ageGateDescription} required minLength={10} maxLength={1000} /></div>
          <div className="form-group"><label htmlFor="ageGateAcceptLabel">Age accepted button</label><input className="form-control" id="ageGateAcceptLabel" name="ageGateAcceptLabel" defaultValue={settings.ageGateAcceptLabel} required minLength={2} maxLength={100} /></div>
          <div className="form-group"><label htmlFor="ageGateDeclineLabel">Age declined button</label><input className="form-control" id="ageGateDeclineLabel" name="ageGateDeclineLabel" defaultValue={settings.ageGateDeclineLabel} required minLength={2} maxLength={100} /></div>
          <div className="form-group full"><label htmlFor="cookieGateTitle">Cookie question</label><input className="form-control" id="cookieGateTitle" name="cookieGateTitle" defaultValue={settings.cookieGateTitle} required minLength={5} maxLength={200} /></div>
          <div className="form-group full"><label htmlFor="cookieGateDescription">Cookie explanation</label><textarea className="form-control" id="cookieGateDescription" name="cookieGateDescription" defaultValue={settings.cookieGateDescription} required minLength={10} maxLength={1000} /></div>
          <div className="form-group"><label htmlFor="cookieGateAcceptLabel">Cookies accepted button</label><input className="form-control" id="cookieGateAcceptLabel" name="cookieGateAcceptLabel" defaultValue={settings.cookieGateAcceptLabel} required minLength={2} maxLength={100} /></div>
          <div className="form-group"><label htmlFor="cookieGateDeclineLabel">Cookies declined button</label><input className="form-control" id="cookieGateDeclineLabel" name="cookieGateDeclineLabel" defaultValue={settings.cookieGateDeclineLabel} required minLength={2} maxLength={100} /></div>
        </div></section>
        <section className="admin-panel"><h2>Footer and information pages</h2><p className="subtle">The page names become links in the public footer. Enter plain text; line breaks are preserved. Have the final privacy wording reviewed by a qualified professional.</p><div className="form-grid content-settings-grid">
          <div className="form-group full"><label htmlFor="aboutPageLabel">About page name</label><input className="form-control" id="aboutPageLabel" name="aboutPageLabel" defaultValue={settings.aboutPageLabel} required minLength={2} maxLength={80} /><small>For example: About or About us.</small></div>
          <div className="form-group full"><label htmlFor="aboutPageContent">About the client</label><textarea className="form-control page-content-input" id="aboutPageContent" name="aboutPageContent" defaultValue={settings.aboutPageContent} maxLength={50000} /></div>
          <div className="form-group full"><label htmlFor="privacyPolicyLabel">Second page name</label><input className="form-control" id="privacyPolicyLabel" name="privacyPolicyLabel" defaultValue={settings.privacyPolicyLabel} required minLength={2} maxLength={80} /><small>For example: Privacy policy.</small></div>
          <div className="form-group full"><label htmlFor="privacyPolicyContent">Privacy policy text</label><textarea className="form-control page-content-input" id="privacyPolicyContent" name="privacyPolicyContent" defaultValue={settings.privacyPolicyContent} maxLength={50000} /></div>
        </div></section>
        <div className="form-actions"><button className="btn" type="submit">Save site content</button><span className="subtle">Changes become public immediately.</span></div>
      </form>
    </>
  );
}
