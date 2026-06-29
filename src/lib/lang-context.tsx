import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { translations, type Lang } from "@/locales/translations";

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

function getVal(obj: Record<string, any>, key: string): string {
  const parts = key.split(".");
  let cur: any = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return key;
  }
  return typeof cur === "string" ? cur : key;
}

export function LangProvider({ children }: { children: ReactNode }) {
  // Start with "es" on server and client to avoid SSR hydration mismatch.
  // After hydration, useEffect reads the saved preference.
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const saved = localStorage.getItem("sp-lang") as Lang | null;
    if (saved && saved in translations) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem("sp-lang", l);
    setLangState(l);
  };

  const t = useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>): string => {
        let val = getVal(translations[lang] as Record<string, any>, key);
        // Fallback to Spanish if key not found in selected language
        if (val === key) val = getVal(translations.es as Record<string, any>, key);
        if (vars) {
          val = val.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
        }
        return val;
      },
    [lang],
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
