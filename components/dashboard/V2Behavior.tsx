"use client";
import { useV2Page } from "@/lib/useV2Page";
import { useTools } from "@/components/tools/ToolsProvider";

// Оживляет v2: состояние стека берёт из общего контекста (панель tools им управляет).
export default function V2Behavior() {
  const { v2State, setV2 } = useTools();
  useV2Page(v2State, () => setV2("credit", false));
  return null;
}
