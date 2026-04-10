# TravelPlanner — Product Plan

> This file is the single source of truth for the project roadmap.
> Update it in-place as features are completed or scope changes.
> Git history preserves all previous versions.

---

## App Identity

- **Name**: TravelPlanner
- **Tagline**: Plan together, travel better
- **Primary device**: iPhone (PWA — Add to Home Screen)
- **Design reference**: [design-preview.html](./design-preview.html)

---

## MVP (v1) — Feature Checklist

### 1. Auth & Onboarding
- [x] Email/password register + login
- [x] Better Auth session management
- [x] 2-screen swipe onboarding (first login only)

### 2. Groups
- [x] Create group (name, optional cover photo)
- [x] Invite members via shareable link `/join/[token]`
- [x] Member roles: owner / admin / member
- [x] Long-press member avatar → context menu (make admin, remove)
- [x] Regenerate invite link

### 3. Trip Management
- [x] Create trip (name, destination, date range, cover image, status)
- [x] Edit / delete trip
- [x] Status lifecycle: `planning → active → completed` (auto-computed from dates)
- [x] Trip card with gradient hero, status badge, member avatar stack
- [x] Swipe left on trip card → delete action

### 4. Itinerary Builder
- [x] Day-by-day timeline view (sticky day headers with JetBrains Mono stamps)
- [x] Add item via FAB → bottom sheet (types: flight / hotel / restaurant / activity / transport / note)
- [x] Edit / delete itinerary item
- [x] Drag-to-reorder within a day
- [x] Item confirmation (tap to confirm, avatar stack showing who confirmed)
- [x] Day filter chips (horizontal scroll)

### 5. Comments & Reactions
- [x] Flat comment thread per trip
- [x] Flat comment thread per itinerary item
- [x] 5 fixed emoji reactions (👍 🎉 ❤️ 😂 ✅)
- [x] Keyboard-aware input pinned to bottom
- [x] SSE real-time updates (new comments appear live)

### 6. File Attachments
- [x] Attach photos / PDFs to trip or itinerary item
- [x] Thumbnail gallery (horizontal scroll in item detail)
- [x] Full-screen viewer with pinch-to-zoom (double-tap to zoom)
- [x] Trip-level attachment grid

### 7. Trip Overview
- [x] Hero card (cover image / gradient, countdown, dates)
- [x] "Next up" card (next itinerary item by date/time)
- [x] Quick stats row (places / items / members)
- [x] Recent activity feed
- [x] Pull-to-refresh

### 8. Presence Indicator
- [x] Show who is viewing the same trip right now (SSE-based)
- [x] Toast notification when a collaborator adds/edits an item

---

## Schema Additions Needed for v1

Beyond the base schema in `docs/DATABASE.md`:

| Addition | Purpose |
|---|---|
| `groups.invite_token` | Shareable join link |
| `itinerary_items.sort_order` | Drag-to-reorder persistence |
| `itinerary_items.location_name`, `location_lat`, `location_lng` | Future map view prep |
| `item_confirmations(id, item_id, user_id)` | Per-user item confirmations |
| `trip_comments.parent_type` + `parent_id` | Trip-level vs item-level comments |
| `trip_comments.reactions` JSONB | Emoji reaction counts |
| `user_presence(id, user_id, trip_id, last_seen_at)` | Live presence indicator |

---

## v2 — High-Value Additions

- [x] **Voting / Polls** — yes/maybe/no per itinerary item, tally bar on card
- [x] **Budget Tracking** — estimated vs actual cost, donut chart, "who paid" log, currency picker, member payer, user-set budget target, itinerary items auto-included
- [x] **Map View** — Leaflet + Mapbox tiles, pins per item, tap pin → item detail sheet
- [x] **Place Search** — debounced autocomplete (Mapbox Geocoding) on item add/edit, stores lat/lng for map pins
- [x] **Packing List** — shared + personal checklists per trip, tap-to-check, swipe-to-delete, grouped by category, progress bar
- [ ] **Trip Templates** — save completed trip structure as reusable template
- [ ] **Push Notifications** — Web Push for comments, votes, "trip starts tomorrow"

---

## v3 / Future

- AI itinerary suggestions (Claude API)
- Flight/hotel booking email parser
- Trip journal / photo memories with shareable album link
- Full expense splitting (Splitwise-style)
- Full offline mode (IndexedDB + sync queue)
- Calendar export (.ics / Google Calendar)
- Native app wrapper (Capacitor → App Store)
- Dark mode

---

## Frontend Style

### Design Inspiration
- **Linear** — interaction precision, surface layering, bottom sheet patterns
- **Airbnb** — warmth, photography treatment, card hierarchy
- **Wanderlog** — travel domain mental models (timeline, map/list)

### Color Palette
| Token | Hex | Use |
|---|---|---|
| Brand (terracotta) | `#E8622A` | CTAs, active states, FAB |
| Ocean blue | `#2D6A8F` | Secondary actions |
| Gold | `#F2A93B` | Day stamps, badges |
| Background | `#FAF8F5` | App background |
| Surface | `#FFFFFF` | Cards |
| Sunken | `#F0EDE8` | Input backgrounds |
| Ink | `#1A1512` | Primary text |
| Ink secondary | `#6B6560` | Supporting text |
| Ink tertiary | `#A09B96` | Timestamps, metadata |
| Border | `#E5E0DA` | Dividers, card borders |
| Status: planning | `#A78BFA` | Purple badge |
| Status: active | `#3D9970` | Green badge |
| Status: completed | `#A09B96` | Grey badge |

### Typography
- **Body**: Plus Jakarta Sans (Google Fonts) — 400/500/600/700
- **Accent**: JetBrains Mono — day stamps ("DAY 01"), invite codes, cost figures
- All form inputs: minimum `font-size: 16px` (prevents iOS keyboard zoom)

### Key Patterns
- **Bottom sheets** (Vaul library) for all overlays — never centered modals for main content
- **Bottom tab bar** (4 tabs) — not a side drawer
- **FAB** (56px circle, terracotta) — fixed above bottom nav on list screens
- **Skeleton screens** — never spinners for list loading
- **Optimistic updates** — React Query cache write-first, roll back on error
- Dark mode: **deferred to v2**, ship v1 light-only

---

## Build Order (Suggested)

1. ✅ Project scaffold (Next.js 16, tRPC, Drizzle, Better Auth, Tailwind v4)
2. ✅ Database schema + migrations
3. ✅ Auth flows (register, login, session, middleware)
4. ✅ Design system (globals.css tokens, BottomSheet component, BottomNav)
5. ✅ Groups (create, invite link, member management)
6. ✅ Trip management (CRUD, auto-status by dates, cover image field)
7. ✅ Itinerary builder (timeline, add/edit/delete items, confirmations)
8. ✅ Comments + reactions + SSE real-time
9. ✅ File attachments (upload/download API, gallery UI, full-screen viewer)
10. ✅ Trip overview improvements + presence indicator (SSE-based "who's here")
11. ✅ PWA manifest + service worker (icons, offline shell caching)
12. ✅ Docker Compose + Nginx deployment config
