import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";

export const trpc = createTRPCReact<AppRouter>();

const queryClient = new QueryClient();
const appsScriptUrl = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL?.trim() ?? "";

function appsScriptLink(): TRPCLink<AppRouter> {
  return () => ({ op }) => observable((observer) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.name = `apps-script-${requestId}`;
    frame.title = "";
    frame.style.display = "none";

    const form = document.createElement("form");
    form.method = "POST";
    form.action = appsScriptUrl;
    form.target = frame.name;
    form.style.display = "none";

    const requestInput = document.createElement("input");
    requestInput.type = "hidden";
    requestInput.name = "bridgeRequest";
    requestInput.value = JSON.stringify({
      requestId,
      path: op.path,
      type: op.type,
      input: op.input,
    });
    form.appendChild(requestInput);

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeoutId);
      form.remove();
      frame.remove();
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.data?.requestId !== requestId) return;
      cleanup();
      if (!event.data.response?.ok) {
        observer.error(TRPCClientError.from(new Error(event.data.response?.error ?? "Falló la solicitud a Apps Script.")));
        return;
      }
      observer.next({ result: { data: event.data.response.data } } as Parameters<typeof observer.next>[0]);
      observer.complete();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      observer.error(TRPCClientError.from(new Error("Apps Script no respondió a tiempo.")));
    }, 30000);

    window.addEventListener("message", onMessage);
    document.body.append(frame, form);
    form.submit();
    return cleanup;
  });
}

const trpcClient = trpc.createClient({
  links: [
    appsScriptUrl
      ? appsScriptLink()
      : httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
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
