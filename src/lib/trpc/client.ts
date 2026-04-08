"use client";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/routers/_app";

export const api = createTRPCReact<AppRouter>();

export function makeQueryClient() {
  return {
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  };
}

export function getTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
      }),
    ],
  });
}
