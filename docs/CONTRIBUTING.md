# Contributing Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 LTS or higher | [nodejs.org](https://nodejs.org) |
| pnpm | 9+ | `npm i -g pnpm` |
| Docker + Docker Compose | Latest stable | [docs.docker.com](https://docs.docker.com) |
| PostgreSQL | 15+ | Running locally or via Docker |

---

## Local Setup

### 1. Clone and install dependencies
```bash
git clone <repo-url>
cd travel-planner
pnpm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in every value. See `.env.example` for descriptions of each variable.

### 3. Set up the database
```bash
# Make sure PostgreSQL is running and the database exists:
createdb travel_planner

# Run migrations:
pnpm drizzle-kit migrate

# Seed with test data (optional):
pnpm db:seed
```

### 4. Start the development server
```bash
pnpm dev
```
App is available at `http://localhost:3000`.

### Test accounts (after seeding)
| Email | Password | Role |
|---|---|---|
| alice@test.com | password | Group owner |
| bob@test.com | password | Member |
| carol@test.com | password | Member |

---

## Development Workflow

### Branch Naming
```
feature/short-description     ← new feature
fix/short-description          ← bug fix
chore/short-description        ← tooling, deps, config
```

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add itinerary item reordering
fix: correct timezone handling for start_time
chore: upgrade drizzle-orm to 0.41
docs: update database schema for attachments
```

### Pull Request Checklist
Before opening a PR:
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm test` passes
- [ ] New features have at least one test
- [ ] `.env.example` updated if new env vars were added
- [ ] `/drizzle` migration files committed alongside schema changes

---

## Available Scripts

```bash
pnpm dev              # Start Next.js dev server with hot reload
pnpm build            # Production build
pnpm start            # Start production server (after build)
pnpm typecheck        # Run tsc --noEmit
pnpm lint             # Run ESLint
pnpm lint:fix         # Run ESLint with --fix
pnpm format           # Run Prettier on all files
pnpm test             # Run Vitest unit tests
pnpm test:e2e         # Run Playwright E2E tests
pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply pending migrations
pnpm db:seed          # Seed database with development data
pnpm db:studio        # Open Drizzle Studio (DB GUI) at localhost:4983
```

---

## Code Style

Enforced automatically by ESLint + Prettier. Run `pnpm lint:fix` before committing.

### Key Rules
- **No `any`** — use `unknown` and narrow, or fix the type
- **No `console.log`** in committed code — use a logger or remove before committing
- **Imports** ordered automatically by ESLint: external → internal → relative
- **Tailwind classes** sorted automatically by the Prettier Tailwind plugin
- **React**: function components only — no class components
- **Async**: `async/await` only — no raw `.then()` chains

### Editor Setup (VS Code)
Install recommended extensions (prompted on first open via `.vscode/extensions.json`):
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Drizzle ORM (if available)

Enable format-on-save in VS Code settings:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

---

## Project Structure Overview

```
src/app/(auth)/        Public pages: login, register
src/app/(app)/         Protected pages: requires session
src/server/routers/    tRPC routers — one file per domain
src/server/db/         Drizzle schema, relations, named queries
src/server/auth.ts     Better Auth configuration
src/components/ui/     shadcn/ui primitives — do not hand-edit
src/components/        Feature-level shared components
src/lib/trpc/          tRPC client and server helpers
```

Full details: see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Adding a New Feature

1. **Define the schema change** (if needed) in `src/server/db/schema.ts`
2. **Generate and apply migration**: `pnpm db:generate && pnpm db:migrate`
3. **Add tRPC procedures** in the relevant router under `src/server/routers/`
4. **Build the UI** in `src/app/(app)/[feature]/`
   - Start with a Server Component for the page
   - Add Client Components only where interactivity is needed
   - Co-locate components in `_components/` inside the route folder
5. **Wire up real-time** if the feature mutates shared state — broadcast via SSE
6. **Write tests** for new tRPC procedures and critical UI paths

---

## Adding a New shadcn/ui Component

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add dialog
```

This auto-generates the component in `src/components/ui/`. Do not hand-edit these files — re-run the command to update them.

---

## Database Changes

See [DATABASE.md](./DATABASE.md) for full schema and naming conventions.

Migration rules:
- Never delete or modify past migration files in `/drizzle/`
- Destructive changes (rename/drop column) require two migrations — see DATABASE.md
- Always commit schema + migration files in the same commit

---

## Docker (Production Deployment)

```bash
# Build and start all services:
docker compose up -d --build

# View logs:
docker compose logs -f app

# Apply migrations inside container:
docker compose exec app pnpm db:migrate

# Restart app only:
docker compose restart app
```

### Deployment Steps (Linux server)
1. Pull latest code: `git pull`
2. Rebuild: `docker compose build app`
3. Apply migrations: `docker compose exec app pnpm db:migrate`
4. Restart: `docker compose up -d app`

No downtime for schema-additive migrations. For breaking schema changes, plan a maintenance window.

---

## Troubleshooting

### `Cannot find module` errors after `pnpm install`
```bash
pnpm install --force
```

### Database connection refused
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running: `pg_ctl status` or `sudo systemctl status postgresql`
- Ensure the database exists: `psql -l | grep travel_planner`

### tRPC type errors after adding a new procedure
```bash
pnpm typecheck
```
TypeScript needs to rebuild the router inference. Restart the TS server in VS Code: `Cmd/Ctrl + Shift + P → Restart TS Server`.

### Drizzle Studio not showing latest schema
```bash
pnpm db:generate  # regenerate introspection
pnpm db:studio
```
