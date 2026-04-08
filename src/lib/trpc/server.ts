import "server-only";
import { createCallerFactory, createTRPCContext } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";
import { cache } from "react";

const createCaller = createCallerFactory(appRouter);

export const createServerCaller = cache(async () => {
  const ctx = await createTRPCContext();
  return createCaller(ctx);
});
