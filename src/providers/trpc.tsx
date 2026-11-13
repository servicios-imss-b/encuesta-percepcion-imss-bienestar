import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
const isPagesWithoutApi = import.meta.env.PROD && import.meta.env.BASE_URL !== "/" && !apiBaseUrl;
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: apiBaseUrl ? `${apiBaseUrl}/api/trpc` : "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        if (isPagesWithoutApi) {
          throw new Error("El backend no está configurado para GitHub Pages. Define VITE_API_BASE_URL con la URL del servidor Node.");
        }

        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error("El backend devolvió una página HTML en vez de JSON. Verifica VITE_API_BASE_URL y que el servidor esté activo.");
        }

        return response;
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
