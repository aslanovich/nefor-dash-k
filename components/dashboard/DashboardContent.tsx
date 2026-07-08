"use client";
import { useEffect, useRef } from "react";
import { contentInner } from "./htmlPartials";

// Контентная колонка (табы/hero/панели/баннеры/онбординг/фид) — БАЙТ-В-БАЙТ одна и та же
// для v1 и v2 (подтверждено диффом оригиналов). Статичная вёрстка.

// Блоки для режима-курсора нейропомощника (п.5): разметка приходит байт-в-байт
// из htmlPartials (dangerouslySetInnerHTML), поэтому data-ai-block навешивается
// в рантайме через querySelector, а не в JSX — как и остальные поведенческие
// хуки этого проекта (useV1Page/useV2Page).
const AI_BLOCKS: Array<[string, string]> = [
  [".hero", "Приветствие"],
  [".chips", "Быстрые действия"],
  [".banners", "Баннеры"],
  [".feed", "С чего начать"],
];

export default function DashboardContent() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const [selector, label] of AI_BLOCKS) {
      root.querySelector<HTMLElement>(selector)?.setAttribute("data-ai-block", label);
    }
  }, []);

  return <main ref={ref} dangerouslySetInnerHTML={{ __html: contentInner }} />;
}
