# DeskBuddy — Frontend (Next.js)

The desk-style UI shell for DeskBuddy. Renders the five interactive desk objects (Calendar, Journal, Camera / Photo Booth, iPod, Bot) on a wood-grain surface with light/dark mode support.

---

## Project Tree

```
frontend/
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── .env.local                          ← API base URL (see below)
├── public/
│   └── favicon.ico                     ← (add your own)
├── src/
│   ├── app/                            ← Next.js 14 App Router
│   │   ├── layout.tsx                  ← root layout, dark-mode toggle, global CSS
│   │   ├── page.tsx                    ← HOME — the desk with all items
│   │   ├── globals.css                 ← Tailwind + wood-grain + grain-overlay
│   │   ├── journal/
│   │   │   └── page.tsx                ← Journal module
│   │   ├── music/
│   │   │   └── page.tsx                ← iPod / Music module
│   │   ├── tasks/
│   │   │   └── page.tsx                ← Tasks / Calendar Lite
│   │   ├── checkin/
│   │   │   └── page.tsx                ← Photo Booth + Streak
│   │   └── bot/
│   │       └── page.tsx                ← Bot command assistant
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx              ← top nav (logo, links, search, theme toggle)
│   │   │   ├── Footer.tsx              ← bottom dock bar
│   │   │   └── DeskLayout.tsx          ← shared page wrapper (bg + Header + Footer)
│   │   ├── desk-items/                 ← individual desk objects (positioned absolutely)
│   │   │   ├── Calendar.tsx            ← white calendar card (dynamic month)
│   │   │   ├── Journal.tsx             ← black notebook + pen
│   │   │   ├── Camera.tsx              ← retro camera (links to check-in)
│   │   │   ├── iPod.tsx                ← blue iPod with click-wheel
│   │   │   └── Bot.tsx                 ← little robot with LED face
│   │   └── ui/                         ← (reserved for shared UI primitives)
│   └── utils/
│       └── cn.ts                       ← classname merger (clsx + tailwind-merge)
└── README.md                           ← this file
```

---

## Prerequisites

| Tool | Min version |
|------|-------------|
| Node.js | 18 LTS or 20 LTS |
| npm (or pnpm / yarn) | ships with Node |

---

## 1 · Install dependencies

```bash
cd frontend
npm install
```

This pulls in Next.js 14, React 18, Tailwind CSS 3, and a couple of small utilities (`clsx`, `tailwind-merge`).

---

## 2 · Environment variables (optional for local dev)

The file `.env.local` already ships with sensible defaults:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8080   # gateway port from docker-compose
```

If your gateway runs on a different port, edit that value before starting.  
**No restart is needed if you haven't changed it from the default.**

---

## 3 · Start the development server

```bash
npm run dev
```

Next.js will print something like:

```
  ▲ Next.js 14.x.x
  Local:        http://localhost:3000
  Network:      http://192.168.x.x:3000
```

Open **http://localhost:3000** in your browser. You should see the desk.

---

## 4 · What you'll see

| Desk object | Position | Clicking it goes to… |
|---|---|---|
| Calendar (white card) | top-centre | `/tasks` |
| Journal (black notebook) | bottom-left | `/journal` |
| Camera | top-left | `/checkin` |
| iPod (blue) | top-right | `/music` |
| Robot (Bot) | bottom-right | `/bot` |

All module pages share the same Header + Footer via `DeskLayout`.  
Each module currently uses **in-memory state** so data resets on refresh — that's by design until the FastAPI microservices backend is wired up.

---

## 5 · Theme toggle

Click the **☀ / 🌙** button in the header to switch light/dark mode.  
Your choice is persisted in `localStorage` under the key `db-theme`.

---

## 6 · Production build (optional)

```bash
npm run build   # compiles to .next/
npm start       # runs the production server on :3000
```

For a real deployment, push `frontend/` to **Vercel** (zero-config) or any platform that supports Next.js.  
Static assets and photos will be served via CDN automatically on Vercel.

---

## 7 · Troubleshooting

| Symptom | Fix |
|---|---|
| `Module not found: @/…` | Make sure `tsconfig.json` has `"baseUrl": "."` and `"paths": { "@/*": ["./src/*"] }`. |
| Fonts not loading | The app fetches `Plus Jakarta Sans` and `VT323` from Google Fonts at runtime. An internet connection is required in dev. |
| Material Icons missing | Same as above — loaded from `fonts.googleapis.com`. |
| Port 3000 in use | Run `npm run dev -- -p 3001` to pick another port. |
| Tailwind classes not applying | Delete `.next/` cache folder and restart: `rm -rf .next && npm run dev`. |

---

## 8 · Auth / Login

DeskBuddy has a full login and registration page at `/login`.

- Navigate to `/login` to create an account or log in
- Your session (JWT) is stored in `localStorage` under `db-token`
- The Header shows your username and a logout button when you're signed in
- All protected pages redirect to `/login` if you're not authenticated

The auth context lives in `src/lib/auth.tsx`. It exposes `useAuth()` which gives you `user`, `token`, `login()`, `register()`, and `logout()`.

The API client (`src/lib/api.ts`) automatically attaches `Authorization: Bearer <token>` to every request to the FastAPI gateway.

---

## 9 · Connecting to the backend

Each module page currently mocks its data locally. To wire up the real microservices:

1. Start the gateway (`docker-compose up`) so it's listening on `:8080`.
2. Replace the mock state in each `page.tsx` with `fetch()` calls to `process.env.NEXT_PUBLIC_API_URL + "/journal/entries"` (etc.).
3. Add a shared `api/` utility folder under `src/` for token management and request helpers.

That's Phase 2 work per the project roadmap — the frontend structure is already set up to receive it.

---

## 9 · Security notes for production

| Thing to do | Why |
|---|---|
| Set `NEXT_PUBLIC_API_URL` to your live gateway URL | Required — the default `localhost:8080` will not work in production |
| Never commit `.env.local` | Contains Spotify and HuggingFace secrets — already in `.gitignore` |
| Add your Vercel URL to gateway CORS | In `services/gateway/main.py` → `allow_origins` list |
| Rotate `JWT_SECRET` in docker-compose | Default is `DEV_SECRET_CHANGE_IN_PRODUCTION` — generate with `openssl rand -hex 32` |

See [`docs/SECURITY.md`](../docs/SECURITY.md) for the full backend security reference.