# Database

PostgreSQL database managed via **Drizzle ORM**.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `trips`, `group_members` |
| Column names | `snake_case` | `created_at`, `trip_id` |
| Primary key | `id` (UUID) | `uuid('id').defaultRandom().primaryKey()` |
| Foreign keys | `{singular_table}_id` | `trip_id`, `user_id`, `group_id` |
| Enum types | `snake_case` | `trip_status`, `member_role` |
| Indexes | `{table}_{columns}_idx` | `trips_group_id_idx` |
| Unique constraints | `{table}_{columns}_uniq` | `group_members_group_id_user_id_uniq` |

### Required Columns on Every Table
```ts
id:         uuid('id').defaultRandom().primaryKey()
created_at: timestamp('created_at').defaultNow().notNull()
updated_at: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
```

---

## Full Schema

### Better Auth Tables (auto-managed)
Better Auth creates and manages these — do not hand-edit.
```
users        id, name, email, email_verified, image, created_at, updated_at
sessions     id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at
accounts     id, user_id, account_id, provider_id, access_token, refresh_token, ...
verifications id, identifier, value, expires_at, created_at, updated_at
```

### groups
A travel group — the top-level organizational unit. One user can belong to many groups.

```ts
export const groups = pgTable('groups', {
  id:          uuid('id').defaultRandom().primaryKey(),
  name:        text('name').notNull(),
  description: text('description'),
  avatarUrl:   text('avatar_url'),
  inviteCode:  text('invite_code').unique(),          // short code for joining
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
})
```

### group_members
Junction table: user ↔ group membership.

```ts
export const memberRoleEnum = pgEnum('member_role', ['owner', 'admin', 'member'])

export const groupMembers = pgTable('group_members', {
  id:        uuid('id').defaultRandom().primaryKey(),
  groupId:   uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      memberRoleEnum('role').default('member').notNull(),
  joinedAt:  timestamp('joined_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  uniq: unique('group_members_group_id_user_id_uniq').on(t.groupId, t.userId),
  groupIdx: index('group_members_group_id_idx').on(t.groupId),
  userIdx:  index('group_members_user_id_idx').on(t.userId),
}))
```

### trips
A single trip owned by a group. Has a lifecycle: planning → active → completed.

```ts
export const tripStatusEnum = pgEnum('trip_status', ['planning', 'active', 'completed'])

export const trips = pgTable('trips', {
  id:          uuid('id').defaultRandom().primaryKey(),
  groupId:     uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  description: text('description'),
  destination: text('destination'),
  coverImage:  text('cover_image'),
  status:      tripStatusEnum('status').default('planning').notNull(),
  startDate:   date('start_date'),                    // nullable until confirmed
  endDate:     date('end_date'),
  metadata:    jsonb('metadata').default({}),         // flexible extra fields
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  groupIdx:   index('trips_group_id_idx').on(t.groupId),
  statusIdx:  index('trips_status_idx').on(t.status),
  dateIdx:    index('trips_start_date_idx').on(t.startDate),
}))
```

### itinerary_items
A single item in a trip's itinerary — could be a flight, hotel, activity, restaurant, note, etc.

```ts
export const itemTypeEnum = pgEnum('item_type', [
  'flight', 'hotel', 'activity', 'restaurant', 'transport', 'note'
])

export const itineraryItems = pgTable('itinerary_items', {
  id:          uuid('id').defaultRandom().primaryKey(),
  tripId:      uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  type:        itemTypeEnum('type').notNull(),
  title:       text('title').notNull(),
  description: text('description'),
  location:    text('location'),
  startTime:   timestamp('start_time', { withTimezone: true }),
  endTime:     timestamp('end_time', { withTimezone: true }),
  cost:        integer('cost'),                       // stored in cents
  currency:    char('currency', { length: 3 }),       // ISO 4217 e.g. 'USD'
  url:         text('url'),                           // booking link, map link
  metadata:    jsonb('metadata').default({}),
  sortOrder:   integer('sort_order').default(0).notNull(),
  createdBy:   uuid('created_by').notNull().references(() => users.id),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  tripIdx:     index('itinerary_items_trip_id_idx').on(t.tripId),
  timeIdx:     index('itinerary_items_start_time_idx').on(t.startTime),
  orderIdx:    index('itinerary_items_sort_order_idx').on(t.tripId, t.sortOrder),
}))
```

### trip_comments
Discussion thread on a trip. Flat list (no nested replies in v1).

```ts
export const tripComments = pgTable('trip_comments', {
  id:        uuid('id').defaultRandom().primaryKey(),
  tripId:    uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  tripIdx: index('trip_comments_trip_id_idx').on(t.tripId),
}))
```

### attachments
Files/photos linked to a trip or a specific itinerary item.

```ts
export const attachments = pgTable('attachments', {
  id:              uuid('id').defaultRandom().primaryKey(),
  tripId:          uuid('trip_id').notNull().references(() => trips.id, { onDelete: 'cascade' }),
  itineraryItemId: uuid('itinerary_item_id').references(() => itineraryItems.id, { onDelete: 'set null' }),
  uploadedBy:      uuid('uploaded_by').notNull().references(() => users.id),
  filename:        text('filename').notNull(),        // original filename
  storagePath:     text('storage_path').notNull(),    // path on disk / object key
  mimeType:        text('mime_type').notNull(),
  sizeBytes:       integer('size_bytes').notNull(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => ({
  tripIdx: index('attachments_trip_id_idx').on(t.tripId),
}))
```

---

## Relations (Drizzle)

```ts
// src/server/db/relations.ts
export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  trips:   many(trips),
}))

export const tripsRelations = relations(trips, ({ one, many }) => ({
  group:          one(groups, { fields: [trips.groupId], references: [groups.id] }),
  itineraryItems: many(itineraryItems),
  comments:       many(tripComments),
  attachments:    many(attachments),
}))

export const itineraryItemsRelations = relations(itineraryItems, ({ one }) => ({
  trip: one(trips, { fields: [itineraryItems.tripId], references: [trips.id] }),
}))
```

---

## Migration Workflow

```bash
# 1. Edit src/server/db/schema.ts
# 2. Generate the migration SQL:
pnpm drizzle-kit generate

# 3. Review the generated file in /drizzle/ before applying
# 4. Apply to your database:
pnpm drizzle-kit migrate

# 5. Commit both schema.ts and the /drizzle/ migration files together
```

### Rules
- Never hand-edit files in `/drizzle/` — always regenerate
- Never edit the schema and skip generating a migration — keep them in sync
- Migration files are append-only — never delete or modify past migrations
- For destructive changes (drop column, rename), add migration in two steps:
  1. Make the column nullable / add the new column
  2. Backfill data, then drop old column in a separate migration

---

## Local Development Seed

```bash
# Run seed script to populate test data:
pnpm db:seed

# Seed creates:
# - 3 users (alice@test.com, bob@test.com, carol@test.com / password: "password")
# - 2 groups
# - 3 trips in various statuses
# - Sample itinerary items
```

---

## PostgreSQL Features in Use

| Feature | Where Used |
|---|---|
| `uuid_generate_v4()` / `gen_random_uuid()` | All primary keys |
| `JSONB` | `trips.metadata`, `itinerary_items.metadata` — flexible per-type data |
| `pgEnum` | `trip_status`, `member_role`, `item_type` — validated at DB level |
| `timestamp with time zone` | `itinerary_items.start_time` / `end_time` — travel crosses timezones |
| `date` (no time) | `trips.start_date` / `end_date` — date-only for trip range |
| Partial indexes | Future: `WHERE status = 'planning'` for active trip queries |

---

## Cost Tracking Note

`itinerary_items.cost` stores values in **integer cents** (e.g., $12.50 → `1250`).
Never store money as `float` or `decimal` in application code.
Convert to display string at the UI layer: `(cost / 100).toFixed(2)`.
