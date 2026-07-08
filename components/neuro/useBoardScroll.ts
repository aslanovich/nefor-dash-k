"use client";
import { RefObject, useEffect } from "react";

/* Скролл-реакция клавиши АИ (п.1): реальный скроллящийся контейнер — .board
   (ToolsProvider.tsx), не window/body. Отдаёт дельту скролла через CSS-переменные
   на переданном элементе — сам transform считает CSS (см. ai-key.css), здесь только
   измерение и лёгкое затухание к нулю, чтобы деформация не залипала после остановки. */

export function useBoardScroll(targetRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const target = targetRef.current;
    const board = document.querySelector<HTMLElement>(".board");
    if (!target || !board) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let lastTop = board.scrollTop;
    let velocity = 0;
    let decayRaf = 0;

    const applyVelocity = (v: number) => {
      const clamped = Math.max(-1, Math.min(1, v / 40));
      target.style.setProperty("--sv", clamped.toFixed(3));
    };

    const decay = () => {
      velocity *= 0.85;
      applyVelocity(velocity);
      if (Math.abs(velocity) > 0.02) {
        decayRaf = requestAnimationFrame(decay);
      } else {
        velocity = 0;
        applyVelocity(0);
        decayRaf = 0;
      }
    };

    const onScroll = () => {
      if (reducedMotion.matches) return;
      const top = board.scrollTop;
      velocity = top - lastTop;
      lastTop = top;
      applyVelocity(velocity);
      if (!decayRaf) decayRaf = requestAnimationFrame(decay);
    };

    board.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      board.removeEventListener("scroll", onScroll);
      if (decayRaf) cancelAnimationFrame(decayRaf);
    };
  }, [targetRef]);
}
