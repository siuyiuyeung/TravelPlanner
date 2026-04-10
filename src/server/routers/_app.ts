import { router } from "../trpc";
import { groupsRouter } from "./groups";
import { tripsRouter } from "./trips";
import { itineraryRouter } from "./itinerary";
import { usersRouter } from "./users";
import { commentsRouter } from "./comments";
import { attachmentsRouter } from "./attachments";
import { budgetRouter } from "./budget";

export const appRouter = router({
  groups: groupsRouter,
  trips: tripsRouter,
  itinerary: itineraryRouter,
  users: usersRouter,
  comments: commentsRouter,
  attachments: attachmentsRouter,
  budget: budgetRouter,
});

export type AppRouter = typeof appRouter;
