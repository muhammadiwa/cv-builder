"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "id" | "en";

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<Language>("id");

  useEffect(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored === "true" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("darkMode", String(next));
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // SW registration failed — app still works without it. Log to surface
        // failures during local dev / in monitoring instead of swallowing.
        // eslint-disable-next-line no-console
        console.warn("[SW] registration failed:", err);
      });
    }
  }, []);

  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider value={{ lang, setLang, isDark, toggleDark }}>
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within Providers");
  return ctx;
}
