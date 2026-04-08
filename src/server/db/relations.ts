import { relations } from "drizzle-orm";
import {
  users,
  sessions,
  accounts,
  groups,
  groupMembers,
  trips,
  itineraryItems,
  itemConfirmations,
  tripComments,
  attachments,
  userPresence,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  groupMemberships: many(groupMembers),
  createdGroups: many(groups),
  createdTrips: many(trips),
  itemConfirmations: many(itemConfirmations),
  comments: many(tripComments),
  presence: many(userPresence),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, { fields: [groups.createdBy], references: [users.id] }),
  members: many(groupMembers),
  trips: many(trips),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  group: one(groups, { fields: [trips.groupId], references: [groups.id] }),
  creator: one(users, { fields: [trips.createdBy], references: [users.id] }),
  itineraryItems: many(itineraryItems),
  comments: many(tripComments),
  attachments: many(attachments),
  presence: many(userPresence),
}));

export const itineraryItemsRelations = relations(itineraryItems, ({ one, many }) => ({
  trip: one(trips, { fields: [itineraryItems.tripId], references: [trips.id] }),
  creator: one(users, { fields: [itineraryItems.createdBy], references: [users.id] }),
  confirmations: many(itemConfirmations),
  attachments: many(attachments),
}));

export const itemConfirmationsRelations = relations(itemConfirmations, ({ one }) => ({
  item: one(itineraryItems, { fields: [itemConfirmations.itemId], references: [itineraryItems.id] }),
  user: one(users, { fields: [itemConfirmations.userId], references: [users.id] }),
}));

export const tripCommentsRelations = relations(tripComments, ({ one }) => ({
  trip: one(trips, { fields: [tripComments.tripId], references: [trips.id] }),
  user: one(users, { fields: [tripComments.userId], references: [users.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  trip: one(trips, { fields: [attachments.tripId], references: [trips.id] }),
  itineraryItem: one(itineraryItems, { fields: [attachments.itineraryItemId], references: [itineraryItems.id] }),
  uploader: one(users, { fields: [attachments.uploadedBy], references: [users.id] }),
}));

export const userPresenceRelations = relations(userPresence, ({ one }) => ({
  user: one(users, { fields: [userPresence.userId], references: [users.id] }),
  trip: one(trips, { fields: [userPresence.tripId], references: [trips.id] }),
}));
