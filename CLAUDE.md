# CLAUDE.md — Travel Planner Project Instructions

This file governs Claude Code's behavior for this project. All rules here override global defaults.

---

## Tech Stack Quick Reference

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| API | tRPC v11 |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Auth | Better Auth |
| UI Components | shadcn/ui (Radix UI) |
| Styling | Tailwind CSS v4 |
| State (server) | TanStack React Query (via tRPC) |
| Real-time | Server-Sent Events (SSE) |
| PWA | next-pwa |
| Deployment | Docker Compose + Nginx |

---

## Development Workflow

### PLAN.md is the source of truth
- **At the start of every session**: read `docs/PLAN.md` to understand what is done and what is next
- **Work in build-order sequence** — do not skip steps or implement features out of order
- **At the end of every session**: update `docs/PLAN.md` — tick off completed checklist items `[x]`, update the Build Order step markers (✅/⬜), and note any partial progress in comments
- The Build Order steps in `docs/PLAN.md` are the canonical sequence; do not deviate without discussing with the user first

---

## Mandatory Rules

### File Operations
- **Always Read before Edit or Write** — never modify a file without reading its current state first
- Use **absolute paths** only — never relative paths in tool calls
- Prefer **Edit** over Write for existing files — only Write when creating new files
- **Never auto-commit** — only commit when explicitly asked by the user

### Code Changes
- **No speculative features** — implement only what is explicitly requested
- **No backwards-compat shims** — change the code directly
- **No unused variables** with leading `_` — delete dead code entirely
- **No extra error handling** for impossible cases — trust TypeScript and framework guarantees
- Run `pnpm lint` and `pnpm typecheck` before marking any task complete

### Scope Control
- Do not refactor surrounding code when fixing a bug
- Do not add docstrings or comments to code you didn't change
- Do not add logging unless explicitly asked

---

## Project File Structure

```
travel-planner/
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Public: login, register, forgot-password
│   │   │   └── [page]/
│   │   │       ├── page.tsx
│   │   │       └── _components/     # Page-local components
│   │   ├── (app)/                   # Protected: requires session
│   │   │   ├── dashboard/
│   │   │   ├── trips/
│   │   │   │   ├── [tripId]/
│   │   │   │   └── new/
│   │   │   ├── groups/
│   │   │   └── profile/
│   │   ├── api/
│   │   │   ├── trpc/[trpc]/route.ts # tRPC HTTP handler
│   │   │   ├── auth/[...all]/route.ts # Better Auth handler
│   │   │   └── sse/                 # SSE endpoints
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── server/
│   │   ├── db/
│   │   │   ├── index.ts             # Drizzle client singleton
│   │   │   ├── schema.ts            # All table definitions
│   │   │   ├── relations.ts         # Drizzle relation definitions
│   │   │   └── queries/             # Named query functions
│   │   ├── routers/
│   │   │   ├── _app.ts              # Root router (merges all routers)
│   │   │   ├── trips.ts
│   │   │   ├── groups.ts
│   │   │   ├── itinerary.ts
│   │   │   └── users.ts
│   │   ├── trpc.ts                  # tRPC init, context, procedure helpers
│   │   └── auth.ts                  # Better Auth instance
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives (do not hand-edit)
│   │   └── [feature]/               # Feature-level shared components
│   ├── lib/
│   │   ├── trpc/
│   │   │   ├── client.ts            # tRPC React client
│   │   │   └── server.ts            # tRPC server caller (for RSC)
│   │   └── utils.ts                 # cn() and other shared utilities
│   └── middleware.ts                # Auth session check for protected routes
├── drizzle/                         # Generated migration files (do not hand-edit)
├── docker/
│   └── nginx.conf
├── docker-compose.yml
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env                             # Never commit — in .gitignore
├── .env.example                     # Commit this — template with no values
└── package.json
```

---

## Naming Conventions

### Files & Directories
- React components: `PascalCase.tsx` (e.g., `TripCard.tsx`)
- All other files: `kebab-case.ts` (e.g., `trip-utils.ts`)
- Directories: `kebab-case` always
- shadcn/ui components live in `src/components/ui/` — never rename them

### TypeScript
- Types and interfaces: `PascalCase`
- Variables, functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` only for true module-level constants
- Zod schemas: suffix with `Schema` (e.g., `createTripSchema`)
- Inferred Zod types: suffix with `Input` (e.g., `CreateTripInput`)

### Database (Drizzle)
- Table names: `snake_case` plural (e.g., `trips`, `group_members`)
- Column names: `snake_case` (e.g., `created_at`, `trip_id`)
- All tables must have: `id` (UUID default gen), `created_at`, `updated_at`
- Foreign keys: `{referenced_table_singular}_id` (e.g., `trip_id`, `user_id`)

### tRPC Routers
- Router files: `src/server/routers/{domain}.ts`
- Procedure names: `camelCase` verb-noun (e.g., `getById`, `create`, `updateStatus`)
- Router namespace matches file name (e.g., `tripsRouter` → accessed as `api.trips.getById`)

---

## TypeScript Rules

```json
// tsconfig.json must have:
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

- Never use `any` — use `unknown` and narrow, or fix the type
- Never use `// @ts-ignore` — fix the type error
- Never use non-null assertion `!` unless you have a comment explaining why it's safe
- Always prefer `type` over `interface` for object shapes (exception: when extending is needed)
- Export types alongside their implementations; never export unused types

---

## tRPC Patterns

### Procedure Types
```ts
// src/server/trpc.ts
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(authMiddleware)      // requires session
export const groupMemberProcedure = t.procedure.use(groupMemberMiddleware) // requires group membership
```

### Router Structure
```ts
// src/server/routers/trips.ts
export const tripsRouter = router({
  getById: protectedProcedure
    .input(z.object({ tripId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // ctx.session.user is always defined here
      // ctx.db is the Drizzle client
    }),

  create: protectedProcedure
    .input(createTripSchema)
    .mutation(async ({ ctx, input }) => { ... }),
})
```

### Error Handling
```ts
// Always use TRPCError — never throw plain Error in procedures
import { TRPCError } from '@trpc/server'

throw new TRPCError({ code: 'NOT_FOUND', message: 'Trip not found' })
throw new TRPCError({ code: 'UNAUTHORIZED' })
throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a group member' })
```

### Calling from Server Components (RSC)
```ts
import { createCaller } from '@/lib/trpc/server'
const api = await createCaller()
const trip = await api.trips.getById({ tripId })
```

### Calling from Client Components
```ts
'use client'
import { api } from '@/lib/trpc/client'
const { data } = api.trips.getById.useQuery({ tripId })
const mutation = api.trips.create.useMutation()
```

---

## Drizzle ORM Patterns

### Schema Definition
```ts
// src/server/db/schema.ts — all tables in one file
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const tripStatusEnum = pgEnum('trip_status', ['planning', 'active', 'completed'])

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  status: tripStatusEnum('status').default('planning').notNull(),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})
```

### Queries
```ts
// src/server/db/queries/trips.ts
// Named functions for complex queries — never inline complex joins in routers
export async function getTripWithItinerary(db: Db, tripId: string) {
  return db.query.trips.findFirst({
    where: eq(trips.id, tripId),
    with: { itineraryItems: true },
  })
}
```

### Migrations
```bash
# Generate migration after schema change:
pnpm drizzle-kit generate

# Apply migration:
pnpm drizzle-kit migrate

# Never hand-edit files in /drizzle/ — always regenerate
```

---

## Better Auth Patterns

### Session in Server Components
```ts
import { auth } from '@/server/auth'
import { headers } from 'next/headers'

const session = await auth.api.getSession({ headers: await headers() })
if (!session) redirect('/login')
```

### Session in tRPC Context
```ts
// Middleware attaches session to ctx — never trust client-provided user IDs
const session = ctx.session  // always use this, never input.userId
```

### Protected Routes (Middleware)
```ts
// src/middleware.ts — checks session for all (app)/* routes
// Public routes: /login, /register, /api/auth/*
```

### Group Membership Check
```ts
// Always verify at the procedure level, not just the route level
const membership = await db.query.groupMembers.findFirst({
  where: and(
    eq(groupMembers.groupId, input.groupId),
    eq(groupMembers.userId, ctx.session.user.id)
  )
})
if (!membership) throw new TRPCError({ code: 'FORBIDDEN' })
```

---

## Component Architecture

### Server vs Client Components
```ts
// DEFAULT: Server Component (no directive needed)
// Fetches data directly, no interactivity

// CLIENT: only when you need:
// - useState / useReducer / useEffect
// - Browser APIs (window, localStorage)
// - Event handlers (onClick, onChange, onSubmit)
// - tRPC client hooks (useQuery, useMutation)
'use client'
```

### Co-location Rule
```
src/app/(app)/trips/[tripId]/
├── page.tsx              ← Server Component, fetches initial data
├── loading.tsx           ← Suspense fallback
├── error.tsx             ← Error boundary
└── _components/          ← All components used only by this route
    ├── TripHeader.tsx
    ├── ItineraryList.tsx
    └── AddItemForm.tsx   ← Client Component (has form state)
```

### Shared Components
Only promote a component to `src/components/` if it's used by 3+ different routes.

---

## SSE (Real-Time) Pattern

### Server Endpoint
```ts
// src/app/api/sse/trip/[tripId]/route.ts
export async function GET(req: Request, { params }: { params: { tripId: string } }) {
  // Verify session and group membership first
  const stream = new ReadableStream({ ... })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

### Client Hook
```ts
// On receiving an event, invalidate React Query cache — don't parse the full payload
useEffect(() => {
  const es = new EventSource(`/api/sse/trip/${tripId}`)
  es.onmessage = () => {
    utils.trips.getById.invalidate({ tripId })
  }
  return () => es.close()
}, [tripId])
```

### Broadcast on Mutation
```ts
// After any tRPC mutation that modifies trip data:
// Notify the SSE broadcaster (in-memory Map<tripId, Set<controller>>)
broadcastTripUpdate(input.tripId)
```

---

## PWA Constraints

- **Cache**: static assets, fonts, icons, shell HTML
- **Network-only**: all API calls (`/api/*`) — never cache auth or data requests
- **Stale-while-revalidate**: images uploaded by users
- The PWA manifest must include `display: "standalone"` and iOS-specific meta tags
- Test "Add to Home Screen" on actual iPhone Safari before considering PWA done

---

## Docker / Deployment Notes

```yaml
# docker-compose.yml services:
# - app: Next.js (port 3000, internal only)
# - nginx: reverse proxy (port 80 exposed to host)
# Cloudflare proxies to Linux host on port 80
# Nginx proxies to app:3000
# PostgreSQL runs outside Docker (existing install)
```

- All secrets via `.env` file — never hardcode
- `NODE_ENV=production` must be set in the app container
- Next.js output: `standalone` mode for smaller Docker image
- Health check endpoint: `/api/health` (returns 200 OK)
