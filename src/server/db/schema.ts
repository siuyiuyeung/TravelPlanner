import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  date,
  jsonb,
  char,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "planning",
  "active",
  "completed",
]);

export const itemTypeEnum = pgEnum("item_type", [
  "flight",
  "hotel",
  "activity",
  "restaurant",
  "transport",
  "note",
]);

// ─── Better Auth tables (managed by better-auth) ─────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  inviteToken: text("invite_token").unique(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const groupMembers = pgTable("group_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  unique("group_members_group_id_user_id_uniq").on(t.groupId, t.userId),
  index("group_members_group_id_idx").on(t.groupId),
  index("group_members_user_id_idx").on(t.userId),
]);

// ─── Trips ────────────────────────────────────────────────────────────────────

export const trips = pgTable("trips", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  destination: text("destination"),
  coverImage: text("cover_image"),
  status: tripStatusEnum("status").default("planning").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  metadata: jsonb("metadata").default({}),
  budgetCents: integer("budget_cents").default(0).notNull(),
  budgetCurrency: char("budget_currency", { length: 3 }).default("HKD").notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("trips_group_id_idx").on(t.groupId),
  index("trips_status_idx").on(t.status),
  index("trips_start_date_idx").on(t.startDate),
]);

// ─── Itinerary ────────────────────────────────────────────────────────────────

export const itineraryItems = pgTable("itinerary_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  type: itemTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  locationName: text("location_name"),
  locationLat: text("location_lat"),
  locationLng: text("location_lng"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  costCents: integer("cost_cents"),
  currency: char("currency", { length: 3 }),
  url: text("url"),
  metadata: jsonb("metadata").default({}),
  routeMode: text("route_mode").default("driving").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdBy: text("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("itinerary_items_trip_id_idx").on(t.tripId),
  index("itinerary_items_start_time_idx").on(t.startTime),
  index("itinerary_items_sort_order_idx").on(t.tripId, t.sortOrder),
]);

export const voteTypeEnum = pgEnum("vote_type", ["yes", "maybe", "no"]);

export const itemVotes = pgTable("item_votes", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => itineraryItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vote: voteTypeEnum("vote").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  unique("item_votes_item_id_user_id_uniq").on(t.itemId, t.userId),
  index("item_votes_item_id_idx").on(t.itemId),
]);

export const itemConfirmations = pgTable("item_confirmations", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id").notNull().references(() => itineraryItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("item_confirmations_item_id_user_id_uniq").on(t.itemId, t.userId),
  index("item_confirmations_item_id_idx").on(t.itemId),
]);

// ─── Expenses ─────────────────────────────────────────────────────────────────

export const expenseCategoryEnum = pgEnum("expense_category", [
  "food",
  "transport",
  "accommodation",
  "activity",
  "other",
]);

export const tripExpenses = pgTable("trip_expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  itineraryItemId: uuid("itinerary_item_id").references(() => itineraryItems.id, { onDelete: "set null" }),
  paidBy: text("paid_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: char("currency", { length: 3 }).default("USD").notNull(),
  category: expenseCategoryEnum("category").default("other").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("trip_expenses_trip_id_idx").on(t.tripId),
  index("trip_expenses_paid_by_idx").on(t.paidBy),
]);

// ─── Packing List ─────────────────────────────────────────────────────────────

export const packingItems = pgTable("packing_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  addedBy: text("added_by").notNull().references(() => users.id),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  category: text("category").default("general").notNull(),
  isPersonal: boolean("is_personal").default(false).notNull(),
  checked: boolean("checked").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("packing_items_trip_id_idx").on(t.tripId),
  index("packing_items_added_by_idx").on(t.addedBy),
]);

// ─── Comments ─────────────────────────────────────────────────────────────────

export const tripComments = pgTable("trip_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentType: text("parent_type").notNull().default("trip"), // "trip" | "item"
  parentId: uuid("parent_id"),                               // null = trip-level
  body: text("body").notNull(),
  reactions: jsonb("reactions").default({}), // { "👍": 2, "🎉": 1, ... }
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("trip_comments_trip_id_idx").on(t.tripId),
  index("trip_comments_parent_idx").on(t.parentType, t.parentId),
]);

// ─── Attachments ──────────────────────────────────────────────────────────────

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  itineraryItemId: uuid("itinerary_item_id").references(() => itineraryItems.id, { onDelete: "set null" }),
  uploadedBy: text("uploaded_by").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("attachments_trip_id_idx").on(t.tripId),
]);

// ─── Presence ─────────────────────────────────────────────────────────────────

export const userPresence = pgTable("user_presence", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  unique("user_presence_user_id_trip_id_uniq").on(t.userId, t.tripId),
  index("user_presence_trip_id_idx").on(t.tripId),
]);
