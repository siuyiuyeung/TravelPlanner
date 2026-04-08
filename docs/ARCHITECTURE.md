# Architecture

## System Topology

```
Internet
   │
   ▼
Cloudflare (DNS + Proxy)
   │  Handles SSL termination (HTTPS → HTTP internally)
   │  DDoS protection, caching for static assets
   ▼
Linux Host (your PC) :80
   │
   ▼
Nginx (Docker container) :80
   │  Reverse proxy
   │  Handles: request buffering, gzip, static file headers
   ▼
Next.js App (Docker container) :3000
   │
   ├──▶ PostgreSQL (existing install on host, or Docker container)
   │
   └──▶ File Storage (local disk, mounted volume)
```

### Cloudflare Configuration
- SSL mode: **Full** (Cloudflare ↔ origin is HTTP; origin serves on port 80)
- Enable "Always Use HTTPS" in Cloudflare dashboard
- Cache rules: cache static assets (`/_next/static/*`), bypass cache for `/api/*`

---

## Stack Decisions

### Why Next.js (full-stack) over separate frontend + backend
- Single codebase: one Docker container, one deployment, one set of dependencies
- Server Actions and Server Components reduce client-server round-trips
- tRPC provides the type-safe API layer without needing a second service
- Trade-off accepted: if traffic ever requires separate scaling, split later

### Why tRPC over REST or GraphQL
- End-to-end TypeScript types with zero code generation
- Input validation (Zod) and output types flow automatically to the client
- Works natively inside Next.js — no separate HTTP server needed
- Trade-off: only usable from TypeScript clients (acceptable for this app)

### Why Drizzle over Prisma
- No Rust binary — smaller Docker image, faster cold starts
- SQL-transparent: queries are readable and debuggable
- TypeScript-first schema definition
- Trade-off: less "magic" than Prisma (deliberate choice)

### Why Better Auth over Clerk/Auth0
- Self-hosted: no external vendor dependency, no SaaS cost
- Full control over session storage and user data (GDPR-friendly)
- Built-in organization/group plugin matches the app's group model
- Trade-off: you own the auth infrastructure (backups, security patches)

### Why SSE over WebSockets
- SSE is unidirectional (server → client), which covers all real-time needs here:
  mutations happen via tRPC, notifications flow via SSE
- Simpler to implement: native browser API, works through Cloudflare proxy without configuration
- Works with HTTP/2 multiplexing on modern browsers
- Trade-off: if simultaneous multi-cursor editing is needed, upgrade to Socket.io

### Why Docker Compose over bare PM2
- Reproducible environment: same container on dev and prod
- Nginx included in the compose stack — no host-level config needed
- Easier to add services (Redis, cron jobs) without touching the host
- Trade-off: slightly more overhead than PM2 for a single Node process

---

## Data Flow

### Standard Request (Server Component)
```
Browser → Cloudflare → Nginx → Next.js
                                  │
                                  ├─ RSC render: calls tRPC server caller
                                  │     └─ tRPC router → Drizzle → PostgreSQL
                                  │
                                  └─ Returns HTML to browser
```

### Standard Request (Client Component mutation)
```
Browser (React) → tRPC client → POST /api/trpc/trips.create
                                    │
                                    └─ Next.js route handler
                                          └─ tRPC router
                                                └─ Drizzle → PostgreSQL
                                                └─ broadcastTripUpdate(tripId)
                                                      └─ SSE connections for this trip
```

### Real-Time Flow
```
User A mutates trip
    └─ tRPC mutation completes
    └─ Server calls broadcastTripUpdate(tripId)
          └─ Finds all open SSE connections for this tripId
          └─ Sends "invalidate" event to each

User B (has SSE connection open for this trip)
    └─ Receives "invalidate" event
    └─ React Query: utils.trips.getById.invalidate({ tripId })
    └─ Background refetch → UI updates
```

### Auth Flow
```
User visits /trips (protected route)
    └─ Next.js middleware runs
    └─ middleware calls Better Auth: getSession(headers)
          ├─ Session valid → request continues to page
          └─ No session → redirect to /login

Login form submits
    └─ Better Auth handler at /api/auth/[...all]
    └─ Validates credentials
    └─ Creates session in PostgreSQL (sessions table)
    └─ Sets session cookie
    └─ Redirect to /dashboard
```

---

## Database Schema Overview

See [DATABASE.md](./DATABASE.md) for full schema and conventions.

### Core Tables
```
users              ← managed by Better Auth
sessions           ← managed by Better Auth
accounts           ← managed by Better Auth (OAuth)

groups             ← a travel group (e.g., "Family", "College Friends")
group_members      ← user ↔ group membership with role (owner/member)

trips              ← a trip owned by a group
trip_members       ← which group members are on this specific trip

itinerary_items    ← places, activities, flights, hotels within a trip
trip_comments      ← discussion thread on a trip
attachments        ← photos/files linked to a trip or itinerary item
```

### Key Relations
```
groups 1──* group_members *──1 users
groups 1──* trips
trips  1──* itinerary_items
trips  1──* trip_comments
trips  1──* attachments
```

---

## PWA Strategy

The app is deployed as a Progressive Web App so iPhone users can add it to their home screen and use it like a native app.

### What is Cached (via next-pwa service worker)
| Resource | Strategy |
|---|---|
| Next.js static assets (`/_next/static/*`) | Cache-first (immutable, hashed filenames) |
| App shell HTML | Stale-while-revalidate |
| Fonts | Cache-first |
| User-uploaded images | Stale-while-revalidate |

### What is NOT Cached
| Resource | Reason |
|---|---|
| `/api/*` (tRPC, auth, SSE) | Data must always be fresh |
| Page HTML for protected routes | Auth state must be checked on server |

### iPhone-Specific Requirements
- `manifest.json`: `display: "standalone"`, `background_color`, `theme_color`
- Meta tags in `<head>`: `apple-mobile-web-app-capable`, `apple-touch-icon`
- No browser chrome in standalone mode — app must provide its own back navigation
- Test on real Safari (iOS simulator doesn't test PWA install)

---

## Security Considerations

- **Session cookies**: `httpOnly: true`, `secure: true`, `sameSite: lax`
- **CSRF**: Better Auth handles CSRF protection for auth routes
- **Authorization**: checked at tRPC procedure level (not just middleware) — defense in depth
- **User IDs**: always derived from session, never trusted from client input
- **SQL injection**: not possible via Drizzle query builder; raw `sql` tagged template is parameterized
- **Environment secrets**: never logged, never exposed to client bundle
- **Cloudflare**: acts as first layer — rate limiting and bot protection configured there

---

## Performance Considerations

- **Server Components** for data fetching: zero JS sent to client for read-only views
- **Streaming**: Next.js `Suspense` boundaries for progressive page loads
- **React Query**: background refetch keeps data fresh without full page reload
- **Indexes**: all foreign keys and frequently filtered columns indexed in PostgreSQL
- **Images**: served from `/public/uploads/` via Nginx (bypasses Node.js entirely)
- **Bundle splitting**: Next.js automatic per-route code splitting
