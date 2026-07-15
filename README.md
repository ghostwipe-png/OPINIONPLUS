# OPINIONPLUS

> Give every person a platform to tell their story, with their name and logo at the top, and the
> tools to build an audience around their truth.

This package contains a working, click-through **frontend** (Next.js) built against a realistic
mock data layer, plus a **backend skeleton** (Cloudflare Workers + D1 + R2) implementing the same
API shape so you can wire the two together without re-architecting anything.

---

## What actually works right now, with zero setup

```
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. You get the entire product, running against an in-browser mock
database (seeded with three sample publishers and stories, persisted to `localStorage`):

- Google sign-in — **simulated** in dev mode (pick a mock account, including the root admin)
- Full story/documentary publishing with a rich text editor, cover images, and file attachments
- The public feed, story pages, likes, star ratings, threaded comments, share links
- Public profiles with follow, and owner-only inline editing
- The admin console: user suspension, media blocking, post deletion, reports, admin management,
  PIN-gated destructive actions, a 5-minute inactivity lock, and an audit log
- Footer pages: About, Privacy Policy, Contact

Nothing here needs an API key to demo. This is the fastest way to see and click through the whole
product.

## What's real vs. simulated in this mode

| Feature | In dev mode | To make it real |
|---|---|---|
| Sign-in | Pick from 3 mock Google accounts | Add a Google OAuth Client ID |
| Image/video upload | Local file preview only, not persisted | Add Cloudinary credentials |
| Document upload | Local file preview only, not persisted | Point at the deployed Worker |
| Data (stories, users, comments…) | Browser `localStorage` | Deploy the Worker + D1 |
| Admin PIN | Hardcoded to `1234` | Set `ADMIN_PIN_HASH` secret on the Worker |

Everything is written so flipping on real credentials doesn't require touching the UI code —
just environment variables.

---

## Project structure

```
opinionplus/
├── frontend/          Next.js app — the entire user-facing product
│   ├── app/            Pages (feed, story, profile, publish, admin, about, privacy, contact, login)
│   ├── components/     Navbar, StoryCard, CommentThread, RichTextEditor, ShareButtons, etc.
│   └── lib/             auth.js (session state), store.js (mock data layer), mediaUpload.js
└── backend/            Cloudflare Worker API (Hono) — same shape the frontend expects
    ├── src/routes/      auth, stories, users, uploads, admin
    ├── src/middleware/  session + role guards, PIN gate for destructive actions
    └── migrations/      D1 schema (users, stories, comments, likes, ratings, follows, reports, admins)
```

---

## Going to production: step by step

### 1. Google OAuth (sign-in)
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth
   2.0 Client ID (Web application).
2. Add your dev and production URLs under **Authorized JavaScript origins**.
3. Put the client ID in `frontend/.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, and in
   `backend/wrangler.toml` as `GOOGLE_CLIENT_ID`.
4. That's it — `components/Providers.js` and `components/GoogleLoginButton.js` already detect the
   env var and switch from the dev-mode account picker to the real `<GoogleLogin>` flow.

### 2. Cloudflare D1 (database)
```
cd backend
npx wrangler d1 create opinionplus
# copy the returned database_id into wrangler.toml
npm run db:migrate:remote
```

### 3. Cloudflare R2 (file storage for PDFs/docs)
```
npx wrangler r2 bucket create opinionplus-files
```
Connect a public bucket domain (R2 dashboard → bucket → Settings → Public access) and set that
URL as `R2_PUBLIC_BASE` in `wrangler.toml`.

### 4. Cloudinary (image/video)
1. Create a free account at [cloudinary.com](https://cloudinary.com) — grab the cloud name from
   the dashboard.
2. Create an **unsigned** upload preset (Settings → Upload → Upload presets).
3. Set `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` in
   `frontend/.env.local`.
4. That's it — `components/Providers.js` loads the Cloudinary widget script automatically once
   `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is set, and `lib/mediaUpload.js` switches from local file
   previews to real uploads.

### 5. Deploy the Worker
```
cd backend
npx wrangler secret put SESSION_SECRET      # any long random string
npx wrangler secret put ADMIN_PIN_HASH      # sha256 of your real admin PIN
npm run deploy
```
Set the deployed URL as `NEXT_PUBLIC_API_BASE` in `frontend/.env.local`.

### 6. Deploy the frontend
Any Next.js host works (Cloudflare Pages, Vercel, etc.). Set the same environment variables
there as in `.env.local`, then build:
```
cd frontend
npm run build
```

### 7. Email (Phase 2 — magic links & notifications)
Not implemented yet, by design (per the brief, this is Phase 2). When you're ready, add a
`resend` or `@sendgrid/mail` call to a new `backend/src/routes/notifications.js`, triggered from
the `follow`, `comment`, and `like` routes.

---

## Root admin & roles

- `adipotech@gmail.com` is hardcoded as the **root admin** in both the frontend
  (`lib/auth.js`) and backend (`ROOT_ADMIN_EMAIL` in `wrangler.toml`). Signing in with that email
  — mock or real — always grants root access, and root can't be removed.
- Root can promote other emails to `admin` from the admin console's **Admins** tab.
- Non-admins hitting `/admin` get a plain 404, both in the frontend page and the Worker's
  `requireAdmin` middleware, per the spec.
- Destructive actions (suspend, block media, delete, add/remove admin) require re-entering a PIN.
  In dev mode that PIN is `1234`; in production it's checked server-side against
  `ADMIN_PIN_HASH`.

---

## Notes on scope

This is a complete, working prototype of every feature in the brief, plus a backend built to the
same contract. The one deliberate gap is real-time email (Phase 2, as specified) — everything
else, including moderation, privacy states, threaded comments, and the masthead-driven design
system, is implemented and click-through today in dev mode.
