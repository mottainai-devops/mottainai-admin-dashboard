import { trpc } from "@/lib/trpc";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { SimpleAuthProvider } from "./contexts/SimpleAuthContext";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const errorCode = error.data?.code;
  const isExpiredSession = errorCode === "UNAUTHORIZED" || error.message === UNAUTHED_ERR_MSG;
  const isForbidden = errorCode === "FORBIDDEN" || error.message === NOT_ADMIN_ERR_MSG;

  if (!isExpiredSession && !isForbidden) return;

  localStorage.removeItem("auth_token");
  sessionStorage.setItem(
    "mottainai_admin_relogin_notice",
    isExpiredSession
      ? "Your session has expired. Please sign in again."
      : "This account does not have administrative access. Please sign in with an authorized account."
  );
  window.location.assign("/login");
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const token = localStorage.getItem('auth_token');
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers: {
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <SimpleAuthProvider>
        <App />
      </SimpleAuthProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
