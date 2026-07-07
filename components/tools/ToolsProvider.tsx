"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import ToolsPanel from "./ToolsPanel";

/* Контекст инструмента tools — общий для всех дашбордов, живёт в root layout
   (переживает смену роута → панель остаётся открытой при свопе, требование #4).
   Держит: текущий дашборд (из pathname), вариант Главной (v1/v2), состояние
   стека v2 (параметры), открытость панели. Управляет body-классами и масштабом
   контента (--csc) при открытой панели — по-разному для Главной и Current. */

export type Variant = "v1" | "v2";
export type Dashboard = "main" | "current";
export interface V2State {
  over: boolean;
  lock: boolean;
  clock: boolean;
  usd: boolean;
  credit: boolean;
  points: boolean;
}
const DEFAULT_V2: V2State = {
  over: false,
  lock: false,
  clock: false,
  usd: false,
  credit: true,
  points: true,
};

interface ToolsCtx {
  dashboard: Dashboard;
  variant: Variant;
  setVariant: (v: Variant) => void;
  v2State: V2State;
  setV2: (k: keyof V2State, val: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (o: boolean) => void;
}

const Ctx = createContext<ToolsCtx | null>(null);
export const useTools = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTools must be used within ToolsProvider");
  return c;
};

export default function ToolsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dashboard: Dashboard = pathname?.startsWith("/current") ? "current" : "main";

  const [variant, setVariant] = useState<Variant>("v1");
  const [v2State, setV2State] = useState<V2State>(DEFAULT_V2);
  const [panelOpen, setPanelOpen] = useState(false);
  const setV2 = useCallback(
    (k: keyof V2State, val: boolean) => setV2State((s) => ({ ...s, [k]: val })),
    []
  );

  // класс дашборда на body (скоуп для push/scale правил)
  useEffect(() => {
    document.body.classList.toggle("dash-main", dashboard === "main");
    document.body.classList.toggle("dash-current", dashboard === "current");
  }, [dashboard]);

  // открытая панель: body.twk-open (рамка-обрезка вьюпорта борда — чистый CSS, styles/tools.css)
  useEffect(() => {
    document.body.classList.toggle("twk-open", panelOpen);
    document.documentElement.classList.toggle("twk-open", panelOpen); // фон вьюпорта на html
    if (panelOpen) {
      // Esc закрывает панель tools
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setPanelOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [panelOpen]);

  return (
    <Ctx.Provider
      value={{ dashboard, variant, setVariant, v2State, setV2, panelOpen, setPanelOpen }}
    >
      <div className="board">{children}</div>
      <ToolsPanel />
    </Ctx.Provider>
  );
}
