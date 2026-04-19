# Photo Selector App — Implementation Plan

## Overview

A photography proofs app where you upload photos to a gallery, send clients a password-protected link, and they select their favorites with optional comments.

**First gallery:** "Cat Spring 2026" — 293 photos, ~112MB total from `/Volumes/KIEHLSEFF/Cat Work Spring 2026/Proofs`

---

## Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | Vercel-native, SSR + API routes in one |
| Styling | Tailwind CSS | Fast to build, responsive |
| Database | Supabase (new project) | Free tier is plenty for metadata |
| Photo Storage | Vercel Blob | Direct browser-to-blob uploads, Vercel Image Optimization built in |
| Auth (admin) | Env var password + httpOnly cookie | Simple, same pattern as OHB admin |
| Auth (client) | Per-gallery bcrypt password + signed JWT cookie | Persists across page refreshes |
| Deploy | Vercel | Auto-deploy from git |

---

## Database Schema (Supabase)

```sql
-- Galleries
create table galleries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  password_hash text not null,
  cover_url text,                         -- first photo's blob URL (for previews + OG image)
  status text not null default 'draft',   -- draft | shared | submitted
  created_at timestamptz default now()
);

-- Photos
create table photos (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references galleries(id) on delete cascade,
  blob_url text not null,
  filename text not null,
  position int not null,
  created_at timestamptz default now()
);

create index idx_photos_gallery on photos(gallery_id, position);

-- Selections (one row per selected photo per submission)
create table selections (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid references galleries(id) on delete cascade,
  photo_id uuid references photos(id) on delete cascade,
  comment text,
  submitted_at timestamptz default now()
);

create index idx_selections_gallery on selections(gallery_id);
```

**Why no `submissions` table?** One client per gallery. When the client submits, all their selections are written to `selections` and the gallery status flips to `submitted`. If they re-submit, old selections are deleted and replaced. The `submitted_at` timestamp on each row serves as the submission record.

---

## File Structure

```
photo_selector_app/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # Root layout, global styles
│   │   ├── page.tsx                          # Redirect to /admin
│   │   │
│   │   ├── admin/
│   │   │   ├── page.tsx                      # Login → gallery list
│   │   │   └── gallery/
│   │   │       └── [id]/
│   │   │           └── page.tsx              # Manage gallery: upload, view selections
│   │   │
│   │   ├── gallery/
│   │   │   └── [slug]/
│   │   │       └── page.tsx                  # Client: password gate → photo selector
│   │   │
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── auth/route.ts             # POST: verify admin password, set cookie
│   │       │   └── galleries/
│   │       │       ├── route.ts              # GET: list all | POST: create gallery
│   │       │       └── [id]/
│   │       │           ├── route.ts          # GET: detail | DELETE: remove gallery + blobs
│   │       │           ├── photos/
│   │       │           │   └── route.ts      # POST: register uploaded photo in DB
│   │       │           └── selections/
│   │       │               └── route.ts      # GET: client's selections for this gallery
│   │       │
│   │       ├── upload/route.ts               # POST: Vercel Blob client-upload token
│   │       │
│   │       └── gallery/
│   │           └── [slug]/
│   │               ├── auth/route.ts         # POST: verify gallery password, set JWT
│   │               ├── photos/route.ts       # GET: all photos for gallery (auth required)
│   │               └── submit/route.ts       # POST: submit selections + comments
│   │
│   ├── components/
│   │   ├── PhotoGrid.tsx                     # Responsive grid with select/deselect
│   │   ├── PhotoLightbox.tsx                 # Full-size modal with comment input
│   │   ├── UploadZone.tsx                    # Drag-and-drop bulk uploader with progress
│   │   └── GalleryCard.tsx                   # Gallery list item for admin
│   │
│   └── lib/
│       ├── supabase.ts                       # Supabase client (service role for API)
│       └── auth.ts                           # JWT sign/verify helpers, cookie helpers
│
├── .env.example                              # Template for required env vars
├── next.config.ts                            # Vercel Blob image domain allowlist
├── tailwind.config.ts
├── package.json
└── tsconfig.json
```

---

## API Routes — Detail

### Admin

| Route | Method | Auth | Request | Response |
|-------|--------|------|---------|----------|
| `/api/admin/auth` | POST | none | `{ password }` | Sets `admin_token` httpOnly cookie |
| `/api/admin/galleries` | GET | admin cookie | — | `Gallery[]` with photo count + status |
| `/api/admin/galleries` | POST | admin cookie | `{ name, slug, password }` | Created `Gallery` |
| `/api/admin/galleries/[id]` | GET | admin cookie | — | `Gallery` + `Photo[]` |
| `/api/admin/galleries/[id]` | DELETE | admin cookie | — | Deletes gallery, photos, blob files |
| `/api/admin/galleries/[id]/selections` | GET | admin cookie | — | `Selection[]` with photo info |

### Upload (two-step: token → register)

| Route | Method | Auth | Request | Response |
|-------|--------|------|---------|----------|
| `/api/upload` | POST | admin cookie | `{ filename, galleryId }` | Vercel Blob client-upload token |
| `/api/admin/galleries/[id]/photos` | POST | admin cookie | `{ blobUrl, filename, position }` | Created `Photo` row |

**Flow:** Browser calls `/api/upload` to get a token → uploads file directly to Vercel Blob → receives blob URL → calls `/api/admin/galleries/[id]/photos` to register the photo in the DB. Two calls per photo, but the heavy file transfer bypasses the server entirely.

### Client

| Route | Method | Auth | Request | Response |
|-------|--------|------|---------|----------|
| `/api/gallery/[slug]/auth` | POST | none | `{ password }` | Sets `gallery_token` JWT cookie |
| `/api/gallery/[slug]/photos` | GET | gallery JWT | — | `{ photos: Photo[], selections: Selection[] }` |
| `/api/gallery/[slug]/submit` | POST | gallery JWT | `{ selections: [{ photoId, comment? }] }` | Replaces previous, sets status=submitted |

**Note:** The photos endpoint also returns existing selections (if any). This handles the case where a client revisits after submitting — their previous picks are pre-loaded into the UI so they can review or re-submit.

### Gallery Page (public metadata)

The `/gallery/[slug]` page is a **server component** that fetches gallery name + cover_url directly from Supabase (no auth needed — this is just the name and one image URL, not the photos). This enables:
- Rendering the gallery name on the password gate without an API call
- Setting Open Graph `<meta>` tags so the link shows a thumbnail + title when shared via iMessage, Slack, etc.
- The cover image as the blurred background behind the password form

```ts
// /gallery/[slug]/page.tsx — server component
export async function generateMetadata({ params }) {
  const gallery = await supabase.from('galleries').select('name, cover_url').eq('slug', params.slug).single()
  return {
    title: gallery.name,
    openGraph: { images: [gallery.cover_url] }
  }
}
```

---

## Design System

### Typography
- **Helvetica Neue** everywhere — headings, body, buttons, labels
- Font stack: `'Helvetica Neue', Helvetica, Arial, sans-serif`
- Weights: 300 (light) for body, 500 (medium) for labels/buttons, 700 (bold) for headings
- No web font loading needed — Helvetica Neue ships with macOS; Arial fallback on Windows

### Color Palette — Black & White Only
| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#FFFFFF` | Page background |
| `--bg-secondary` | `#F5F5F5` | Card backgrounds, hover states |
| `--border` | `#E0E0E0` | Dividers, card borders |
| `--text` | `#000000` | Primary text |
| `--text-secondary` | `#666666` | Captions, metadata |
| `--accent` | `#000000` | Selected state, buttons, active indicators |
| `--accent-inverse` | `#FFFFFF` | Text on black buttons/overlays |

No color anywhere. Selected photos get a **black border + black checkmark circle**, not blue. Buttons are black with white text. Everything monochrome.

### Layout Principles
- **Minimalistic** — generous whitespace, no decorative elements
- **Clean grid** — tight photo grid, minimal gaps (4-8px)
- **Sticky controls** — selection counter + submit button fixed at bottom of viewport so they're always reachable while scrolling through 293 photos
- **No rounded corners** on photos (sharp edges, editorial feel)
- **Thin borders** (1px) — nothing heavy

### Mobile Optimization
- **Grid columns**: 2 on small phones (<640px), 3 on tablets (640-1024px), 5 on desktop (1024+)
- **Touch targets**: select circles are 44×44px minimum (Apple HIG)
- **Sticky bar**: accounts for iOS safe area (`env(safe-area-inset-bottom)`)
- **Lightbox**: full-viewport on mobile, large tap areas for prev/next (entire left/right half)
- **No hover states depended on** — everything works with tap only
- **Password form**: `font-size: 16px` on inputs to prevent iOS zoom
- **Scroll**: `-webkit-overflow-scrolling: touch` for smooth scroll on iOS

### Client Gallery — Interaction Detail

**Thumbnail grid:**
- Small thumbnails in a tight grid (5 columns desktop, 3 mobile, 2 on small phones)
- Each thumbnail has a **select checkbox overlay** in the top-right corner — always visible, not hidden behind hover
- Tapping the checkbox toggles selection (black filled circle = selected, empty circle = unselected)
- Tapping the photo itself opens the expanded/lightbox view

**Expanded view (lightbox):**
- Full-screen black overlay, photo centered and large
- Left/right arrows to navigate between photos
- Select toggle button visible at bottom
- Comment text input visible at bottom
- Close (×) in top-right
- Keyboard: arrow keys navigate, Escape closes

**Sticky bottom bar:**
- Always visible, white background with top border
- Left: "X selected" count
- Right: "Submit Selections" button (black, bold)
- Compact — doesn't eat into photo viewing space

---

## Key Technical Decisions

### Photo Upload (293 files, 112MB)

- **Client-side upload** via `@vercel/blob/client` — files go browser → Blob, not through the API route
- **Parallel uploads**: 6 concurrent uploads at a time (browser limit per origin)
- **Progress tracking**: Overall counter ("147 / 293 uploaded") + progress bar
- **Blob path**: `galleries/{galleryId}/{filename}` for organization
- **Per-file flow**: (1) get token from `/api/upload` → (2) upload to Blob → (3) register in DB via `/api/admin/galleries/[id]/photos`
- **Retry**: Failed uploads retry up to 3 times before showing error
- **Resume**: If upload is interrupted, admin can re-visit the page. UploadZone compares filenames against already-registered photos and skips duplicates
- **Deletion cleanup**: `DELETE /api/admin/galleries/[id]` deletes blob files via `del()` from `@vercel/blob` before removing DB rows (cascade handles photos/selections)

### Image Display (Client Gallery)

- **Use `next/image`** with Vercel Blob URLs — Vercel Image Optimization serves responsive sizes automatically
- **Grid thumbnails**: `width={300}` — small square crops, fast to load (~25KB each)
- **Expanded view**: `width={1400}` — large enough for proofing on retina screens
- **Lazy loading**: `loading="lazy"` on all grid images (native browser)
- **293 photos at ~25KB optimized ≈ 7MB total grid** — loads fast, no virtualization needed

### Client Selections (UX)

1. Client enters password → JWT cookie set → page shows thumbnail grid
2. Each thumbnail has a **persistent select circle** in the top-right (always visible, not hover-dependent)
3. Tap the circle → toggles selection (no page navigation)
4. Tap the photo itself → opens expanded view with nav arrows, select toggle, and comment input
5. **Sticky bottom bar** always visible: selection count on left, submit button on right
6. **Selections saved to `localStorage`** as they browse — resilient to accidental tab close
7. "Submit" button → POST to API → clears localStorage → shows confirmation
8. **Re-submission allowed**: overwrites previous selections (deletes old rows, inserts new)

### Password Auth

- **Admin**: `ADMIN_PASSWORD` env var, compared directly. On success, set a signed httpOnly cookie (JWT with `{ role: "admin" }`, expires 7 days).
- **Gallery client**: Password stored as bcrypt hash in `galleries.password_hash`. On success, set a signed httpOnly cookie (JWT with `{ galleryId, slug }`, expires 30 days).
- **JWT secret**: Single `JWT_SECRET` env var used for both admin and client tokens.
- **No session table** — stateless JWT validation.

### Gallery Slug

Auto-generated from name: `"Cat Spring 2026"` → `"cat-spring-2026"`. Editable during creation. Used in the shareable URL: `yourdomain.com/gallery/cat-spring-2026`

---

## Environment Variables

```env
# Supabase (new project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Auth
ADMIN_PASSWORD=
JWT_SECRET=                    # openssl rand -hex 32
```

**6 env vars total.** No Resend, no Google Sheets, no hCaptcha.

---

## Pages — Wireframe Descriptions

### `/admin` — Gallery Dashboard

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  GALLERIES                        [+ New Gallery]│
│                                                  │
│  ─────────────────────────────────────────────── │
│  Cat Spring 2026                                 │
│  293 photos · Submitted                          │
│  gallery/cat-spring-2026              Copy · View│
│  ─────────────────────────────────────────────── │
│  (next gallery)                                  │
│  ─────────────────────────────────────────────── │
│                                                  │
└──────────────────────────────────────────────────┘
```

### `/admin/gallery/[id]` — Gallery Detail

**Upload view:**
```
┌──────────────────────────────────────────────────┐
│  ← Back                                          │
│                                                  │
│  Cat Spring 2026                                 │
│  [Upload]  [Selections]                          │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │     Drop photos here or click to browse    │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  147 / 293 uploaded  ██████████░░░░░░░░░░        │
│                                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │     │ │     │ │     │ │     │ │     │       │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │
└──────────────────────────────────────────────────┘
```

**Selections view (after client submits):**
```
┌──────────────────────────────────────────────────┐
│  ← Back                                          │
│                                                  │
│  Cat Spring 2026                                 │
│  [Upload]  [Selections]                          │
│                                                  │
│  47 of 293 selected · April 20, 2026             │
│  [Copy Filenames]                                │
│  ( ) All  (●) Selected only                      │
│                                                  │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                │
│  │ ● ✓ │ │ ● ✓ │ │ ● ✓ │ │ ● ✓ │               │
│  │     │ │     │ │     │ │     │               │
│  └─────┘ └─────┘ └─────┘ └─────┘                │
│  "love"  "crop?"                                 │
└──────────────────────────────────────────────────┘

"Copy Filenames" → copies to clipboard:
DSC01155.jpg, DSC01172.jpg, DSC01203.jpg, ...
(comma-separated, sorted by filename)
```

### `/gallery/[slug]` — Client View

**Password gate (centered, cover image as backdrop):**
```
┌──────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░ cover image (blurred) ░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│              ┌────────────────────┐              │
│              │  Cat Spring 2026   │              │
│              │  Enter password    │              │
│              │                    │              │
│              │  [______________]  │              │
│              │  [■■■ Enter ■■■]   │              │
│              └────────────────────┘              │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└──────────────────────────────────────────────────┘

Cover image = first uploaded photo (gallery.cover_url).
Also used as Open Graph image so the link has a thumbnail when shared.
White card centered over blurred cover. Minimal.
```

**Photo selector (the core screen):**
```
┌──────────────────────────────────────────────────┐
│  Cat Spring 2026                                 │
│                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │    ○ │ │    ● │ │    ○ │ │    ○ │ │    ● │   │
│  │      │ │      │ │      │ │      │ │      │   │
│  │thumb │ │thumb │ │thumb │ │thumb │ │thumb │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │    ○ │ │    ○ │ │    ● │ │    ○ │ │    ○ │   │
│  │      │ │      │ │      │ │      │ │      │   │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘   │
│  ... (scroll)                                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  12 selected              [Submit ■■■■■■] │  │  ← STICKY
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

○ = unselected (hollow circle, top-right of thumbnail, always visible)
● = selected (filled black circle with white checkmark)
Tap ○/● = toggle selection
Tap photo = open expanded view
```

**Expanded view (tap on photo):**
```
┌──────────────────────────────────────────────────┐
│                                              [×] │
│                                                  │
│  [‹]         ┌────────────────────┐         [›]  │
│              │                    │              │
│              │                    │              │
│              │    Full-size       │              │
│              │    photo           │              │
│              │                    │              │
│              │                    │              │
│              └────────────────────┘              │
│                                                  │
│  DSC01203.jpg                                    │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ [● Selected]  [Add comment______________ ] │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘

Black background. White text. Controls at bottom always visible.
← → arrow keys navigate. Escape closes.
```

---

## Configuration Details

### next.config.ts
```ts
// Allow next/image to load from Vercel Blob storage
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
  ],
}
```

### Tailwind CSS (v4 — CSS-based config)
```css
/* globals.css */
@import "tailwindcss";

@theme {
  --font-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --color-bg: #FFFFFF;
  --color-bg-secondary: #F5F5F5;
  --color-border: #E0E0E0;
  --color-text: #000000;
  --color-text-secondary: #666666;
}
```
All colors referenced via Tailwind classes like `bg-bg`, `text-text-secondary`, `border-border`. Easy to tweak in one place.

### Gallery Cover Image
- The first photo (position=0) in each gallery serves as the **cover image**
- Used in: admin gallery cards, client password page background/header, and Open Graph meta tag for link previews
- Stored as `cover_url` on the `galleries` table for fast access (set when first photo is registered)

---

## End-to-End Connectivity Trace

Every step in the app verified against API routes, DB schema, and auth:

```
ADMIN CREATES GALLERY
  Browser → POST /api/admin/auth { password }
    → compare to ADMIN_PASSWORD env var
    → sign JWT { role: "admin" } with JWT_SECRET
    → set httpOnly cookie "admin_token" (7 day expiry)

  Browser → POST /api/admin/galleries { name, slug, password }
    → verify admin_token cookie
    → bcrypt.hash(password)
    → INSERT INTO galleries (name, slug, password_hash, status)
    → return { id, slug }

ADMIN UPLOADS PHOTOS (per file, 6 concurrent)
  Browser → POST /api/upload { filename, galleryId }
    → verify admin_token cookie
    → return Vercel Blob client-upload token

  Browser → Vercel Blob (direct upload, bypasses server)
    → returns { url: "https://...blob.vercel-storage.com/..." }

  Browser → POST /api/admin/galleries/[id]/photos { blobUrl, filename, position }
    → verify admin_token cookie
    → INSERT INTO photos (gallery_id, blob_url, filename, position)
    → if position === 0: UPDATE galleries SET cover_url = blobUrl
    → return { id }

  (repeat for all 293 files)

ADMIN SHARES LINK
  → Copy URL: https://yourdomain.com/gallery/cat-spring-2026
  → Send to client with password

CLIENT ENTERS GALLERY
  Browser → GET /gallery/cat-spring-2026
    → Server renders page shell (gallery name from slug in URL)
    → Shows password form with cover image as background

  Browser → POST /api/gallery/cat-spring-2026/auth { password }
    → SELECT * FROM galleries WHERE slug = 'cat-spring-2026'
    → bcrypt.compare(password, gallery.password_hash)
    → sign JWT { galleryId, slug } with JWT_SECRET
    → set httpOnly cookie "gallery_token" (30 day expiry)

  Browser → GET /api/gallery/cat-spring-2026/photos
    → verify gallery_token cookie, check slug matches
    → SELECT * FROM photos WHERE gallery_id = ? ORDER BY position
    → SELECT * FROM selections WHERE gallery_id = ?
    → return { photos: [...], selections: [...] }

  → Render grid. Pre-load any existing selections into state.
  → Also restore from localStorage (merge: DB wins on conflict).

CLIENT SELECTS + SUBMITS
  → Click ○/● toggles selection in React state + localStorage
  → Click photo opens expanded view (comment input visible)

  Browser → POST /api/gallery/cat-spring-2026/submit
    { selections: [{ photoId: "uuid", comment: "love this" }, ...] }
    → verify gallery_token cookie
    → BEGIN transaction
    → DELETE FROM selections WHERE gallery_id = ?
    → INSERT INTO selections (gallery_id, photo_id, comment) VALUES ...
    → UPDATE galleries SET status = 'submitted' WHERE id = ?
    → COMMIT
    → return { success: true }

  → Clear localStorage. Show confirmation.

ADMIN REVIEWS SELECTIONS
  Browser → GET /api/admin/galleries/[id]/selections
    → verify admin_token cookie
    → SELECT s.*, p.blob_url, p.filename, p.position
      FROM selections s JOIN photos p ON s.photo_id = p.id
      WHERE s.gallery_id = ?
      ORDER BY p.position
    → return selections with photo data
```

---

## Build Order

| Step | Task | Details |
|------|------|---------|
| 1 | Scaffold | `npx create-next-app`, install deps, Tailwind config |
| 2 | Supabase setup | User creates project, I provide SQL, configure env vars |
| 3 | Auth system | Admin + client JWT auth, middleware-free (check in API routes) |
| 4 | Admin: gallery CRUD | Create, list, delete galleries |
| 5 | Upload system | Vercel Blob client-upload with progress UI |
| 6 | Client: gallery view | Password gate → photo grid → lightbox |
| 7 | Client: selections | Select/deselect, comments, localStorage persistence, submit |
| 8 | Admin: view selections | Selected photos view with comments, filter toggle |
| 9 | Seed first gallery | Upload "Cat Spring 2026" 293 photos |
| 10 | Deploy to Vercel | Link project, set env vars, deploy |

---

## Limits & Gotchas

| Concern | Detail |
|---------|--------|
| **Vercel Blob free tier** | 500MB. This gallery is 112MB → room for ~3 more. Pro plan = 4.5GB. |
| **Vercel Image Optimization** | Free: 1000 source images/mo. This gallery has 293. Fine for a few galleries, but watch if scaling. Pro: 5000/mo. |
| **Supabase free tier** | 500MB DB, 50K rows. Gallery metadata is tiny — no concern. |
| **Upload reliability** | External drive must stay mounted during upload. If interrupted, re-upload picks up where it left off (skips existing filenames). |
| **No email notifications** | You'll need to manually check admin for submissions. Can add Resend later. |
| **No download zip** | Admin views selections in-browser. Export/download can be added later. |
| **Single client per gallery** | Re-submission overwrites. If you need multiple reviewers, that's a v2 feature. |

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "@vercel/blob": "latest",
    "@supabase/supabase-js": "^2",
    "jose": "^5",
    "bcryptjs": "^2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2",
    "@types/react": "^19",
    "typescript": "^5",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4"
  }
}
```

- **`jose`** — JWT sign/verify (edge-compatible, no native deps unlike `jsonwebtoken`)
- **`bcryptjs`** — Pure JS bcrypt (no native compilation issues on Vercel)
- **No UI library** — Tailwind only, keeps it lean and easy to modify

---

## Pre-Flight Checklist (before build)

You need to do these. I'll handle everything else.

- [ ] **Create a new Supabase project** at [supabase.com](https://supabase.com)
  - Get: Project URL, Anon Key, Service Role Key
- [ ] **Create a Vercel Blob store** (Vercel dashboard → Storage → Create → Blob)
  - Get: `BLOB_READ_WRITE_TOKEN`
- [ ] **Pick a JWT secret**: run `openssl rand -hex 32` in terminal
- [ ] **Pick an admin password**

Then give me the 6 env vars and I'll wire everything up:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
BLOB_READ_WRITE_TOKEN=
JWT_SECRET=
ADMIN_PASSWORD=
```
