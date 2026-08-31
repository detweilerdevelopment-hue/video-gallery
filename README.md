# FrameVault

Production video gallery and small content-management system built with Next.js, MongoDB Atlas, and Backblaze B2. The original static visual prototype remains in `old/`; the live application is at the repository root.

## Features

- Server-rendered, responsive gallery with search and category filters
- Stable, shareable video pages with Backblaze B2 playback
- Playback view counting with request rate limiting
- Protected owner/editor admin area
- Admin-only video, poster, and banner uploads with short-lived Backblaze upload URLs
- Draft, publish, unpublish, archive, restore, feature, and order video workflows
- Direct signed Backblaze video/image uploads from the protected admin area (media does not pass through Next.js)
- Editable banner, top description, featured video, About and Privacy Policy pages, footer links, and categories
- Audit trail, MongoDB indexes, environment validation, SEO metadata, sitemap, and health endpoint

## Requirements

- Node.js 20.9 or newer
- Complete MongoDB Atlas SRV connection string and database user
- A public Backblaze B2 bucket and bucket-restricted S3-compatible application key

## Local setup

1. Install packages:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env.local` and enter complete development credentials. Do not commit this file.

3. In MongoDB Atlas, allow access from the development machine. The hostname must be the full Atlas hostname copied from **Connect > Drivers**, not only a cluster display name.

4. Generate a strong `AUTH_SECRET`, for example:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

5. Set temporary `ADMIN_EMAIL` and an `ADMIN_PASSWORD` of at least eight characters in `.env.local`, then initialize indexes, site settings, categories, and the first owner:

   ```powershell
   npm run seed
   ```

   Remove `ADMIN_PASSWORD` from the environment after seeding. Run the seed again with a new value to rotate the owner's password.

6. Start the application:

   ```powershell
   npm run dev
   ```

7. Open `http://localhost:3000` for the gallery and `http://localhost:3000/admin` for administration.

## Backblaze B2 configuration

Create a public B2 bucket and a bucket-restricted Read and Write application key. Add the six `B2_*` values from `.env.example`; the key ID and application key remain server-only. The browser receives only a short-lived URL for one validated object key after admin authorization.

Configure browser upload permissions after setting `APP_URL`:

```powershell
npm run storage:configure
```

Uploads are restricted to the `videos/` and `images/` prefixes. Backblaze does not transcode media or generate thumbnails, so upload web-ready MP4/WebM videos and a poster image for every gallery item.

## Commands

```powershell
npm run dev
npm run typecheck
npm test
npm run build
npm run storage:configure
npm run seed
```

## Deployment checklist

- Use separate staging and production databases, B2 buckets, and restricted application keys.
- Add all secrets through the hosting provider's encrypted environment store.
- Set `APP_URL` to the exact HTTPS origin; upload signature requests enforce it.
- Configure Atlas network access for the deployment platform and use a least-privilege database user.
- Run `npm run seed` once against production, then remove the seed password.
- Configure B2 CORS and test a real video, poster, and banner upload plus replacement, publish, unpublish, and playback.
- Enable Atlas backups and application error monitoring.
- Run `npm run typecheck`, `npm test`, and `npm run build` before promotion.
- Rotate any credential that has been pasted into chat, email, source code, or logs.

See [plan.md](./plan.md) for the full architecture, phased delivery, testing, security, and extension roadmap.
