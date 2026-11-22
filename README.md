# Reel Tracker

Minimalist daily 3-slot Instagram Reel schedule tracker and analytics dashboard for a 3-member GTA 6 content team operating in **PKT (`Asia/Karachi`, UTC+5, no DST)**.

## Local Development

```bash
npm install
npm run dev
```

Default team profiles and PINs:
- **Zohaib** (`#0071e3`) — PIN `1111`
- **Huzaifa** (`#30d158`) — PIN `2222`
- **Hashir** (`#ff9f0a`) — PIN `3333`

## Backend Configuration

The app defaults to `VITE_DATA_SOURCE=insforge` when `VITE_INSFORGE_URL` and `VITE_INSFORGE_ANON_KEY` are set in `.env.local`, and supports `local` (`localStorage`) or `api` (custom REST backend).

All UI components communicate strictly through `src/lib/data.ts`, which selects `insforgeAdapter`, `apiAdapter`, or `localAdapter` automatically.

### InsForge Setup
1. Link your InsForge project (`npx @insforge/cli link --project-id <id>`).
2. Apply migrations (`npx @insforge/cli db migrations up --all`).
3. Put `VITE_DATA_SOURCE=insforge`, `VITE_INSFORGE_URL`, and `VITE_INSFORGE_ANON_KEY` into `.env.local` and restart the dev server.

### Custom REST Backend (`VITE_DATA_SOURCE=api`)

Set the following environment variables in `.env.local`:

```env
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:4000
```

## REST API Contract

When `VITE_DATA_SOURCE=api`, the client expects these endpoints under `VITE_API_BASE_URL`:

### `GET /members`
Returns all team members (without PINs).

```json
[
  { "id": "zohaib", "name": "Zohaib", "avatarColor": "#0071e3" },
  { "id": "member-2", "name": "Huzaifa", "avatarColor": "#30d158" },
  { "id": "member-3", "name": "Hashir", "avatarColor": "#ff9f0a" }
]
```

### `POST /auth/verify-pin`
Request:
```json
{ "memberId": "zohaib", "pin": "1111" }
```
Response:
```json
{ "ok": true }
```

### `GET /posts?from=YYYY-MM-DD&to=YYYY-MM-DD`
Inclusive PKT date range query. Returns recorded posts:
```json
[
  {
    "id": "2026-11-22-1",
    "postDate": "2026-11-22",
    "slot": 1,
    "posted": true,
    "postedBy": "zohaib",
    "postedAt": "2026-11-22T09:42:00.000Z",
    "reelUrl": "https://www.instagram.com/reel/example/",
    "captionRef": "GTA 6 Vice Beach trailer breakdown"
  }
]
```

### `PUT /posts`
Upserts a slot by `(postDate, slot)`.
Request:
```json
{
  "postDate": "2026-11-22",
  "slot": 2,
  "memberId": "zohaib",
  "reelUrl": "https://www.instagram.com/reel/example/",
  "captionRef": "Map leak comparison"
}
```
Response: Updated `DailyPost` JSON object.

### `DELETE /posts`
Undoes a posted slot (must validate `memberId` matches `postedBy`).
Request:
```json
{
  "postDate": "2026-11-22",
  "slot": 2,
  "memberId": "zohaib"
}
```
Response: Updated `DailyPost` JSON object with `posted: false`.
