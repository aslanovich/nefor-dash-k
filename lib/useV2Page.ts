"use client";
import { useEffect, useRef } from "react";
import type { V2State } from "@/components/tools/ToolsProvider";

/* Поведение v2 — порт инлайн-скрипта 2/index.html (кроме твикера и mountNeuroBar).
   Твикер вынесен в общую ToolsPanel (layout); состояние стека приходит из контекста (st),
   layout() пересчитывает top'ы при его смене. NeuroBar — отдельный компонент.

   Два эффекта: монтажный (слушатели/«мышление» задач — один раз, с cleanup) и
   layout-эффект (перекладка стека при смене st). tasksFinal захардкожен (StrictMode). */

const TASKS_FINAL =
  "У вас 15 задач, из них 4 требуют реакции. В тарифах заканчивается лимит на операции. Появились подсказки по оптимизации расходов. Еще 2 новых задания — настроить терминал и защиту от блокировок";

export function useV2Page(st: V2State, hideCredit: () => void) {
  const stRef = useRef(st);
  stRef.current = st;
  const hideRef = useRef(hideCredit);
  hideRef.current = hideCredit;
  const layoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));
    let alive = true;
    const add = (t: Window | Document | HTMLElement, type: string, h: EventListener) => {
      t.addEventListener(type, h);
      cleanups.push(() => t.removeEventListener(type, h));
    };
    const byId = (id: string) => document.getElementById(id) as HTMLElement;
    const qs = (s: string) => document.querySelector(s) as HTMLElement;

    const sb = qs(".sidebar");
    if (!sb) return;

    // ── стек строк: layout() читает актуальное состояние из stRef ──
    const rows: Record<string, HTMLElement> = {
      over: byId("rowOver"),
      lock: byId("rowLock"),
      clock: byId("rowClock"),
      usd: byId("rowUsd"),
      credit: byId("rowCredit"),
      points: byId("rowPoints"),
    };
    const rowBal = byId("rowBal");
    const div1 = byId("m2Div1");
    const qa = byId("m2QA");
    const mb = byId("m2MB");
    const sbScroll = qs(".sb-scroll");
    const sbBody = qs(".sb-body");
    const RH: Record<string, number> = { over: 42, lock: 42, clock: 42, usd: 46, credit: 46, points: 44 };
    const GAP: Record<string, number> = { over: 12, lock: 16, clock: 16, usd: 24, credit: 24, points: 24 };

    function layout() {
      const s = stRef.current as unknown as Record<string, boolean>;
      let y = 84 + 46;
      rowBal.style.top = "84px";
      for (const k of ["over", "lock", "clock", "usd", "credit", "points"]) {
        rows[k].style.top = y + GAP[k] + "px";
        rows[k].classList.toggle("off", !s[k]);
        rows[k].setAttribute("aria-hidden", String(!s[k]));
        if (s[k]) y += GAP[k] + RH[k];
      }
      div1.style.top = y + 32 + "px";
      qa.style.top = y + 61 + "px";
      mb.style.top = y + 165 + "px";
      const bottom = y + 165 + 257;
      const vh = sbScroll.clientHeight;
      sbBody.style.height = bottom + 24 <= vh ? "100%" : bottom + 110 + "px";
    }
    layoutRef.current = layout;
    layout();
    add(window, "resize", layout);

    // крестик на кредите → прячет ячейку через контекст
    const creditX = byId("m2CreditX");
    if (creditX) add(creditX, "click", () => hideRef.current());

    // ── крылья ──
    const burger = byId("m2Burger");
    const moreBtn = byId("m2More");
    const wingPay = qs(".m2-wing-pay");
    const wingMore = qs(".m2-wing-more");
    function setWing(w: "pay" | "more" | null) {
      sb.classList.toggle("pay", w === "pay");
      sb.classList.toggle("more", w === "more");
      burger.setAttribute("aria-expanded", String(w === "pay"));
      burger.setAttribute("aria-label", w === "pay" ? "Закрыть меню" : "Открыть меню");
      moreBtn.setAttribute("aria-expanded", String(w === "more"));
      if (wingPay) wingPay.setAttribute("aria-hidden", String(w !== "pay"));
      if (wingMore) wingMore.setAttribute("aria-hidden", String(w !== "more"));
    }
    add(burger, "click", () => setWing(sb.classList.contains("pay") ? null : "pay"));
    add(moreBtn, "click", () => setWing(sb.classList.contains("more") ? null : "more"));
    add(document, "keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") setWing(null);
    });

    // ── скролл-«колбаска» ──
    const thumb = qs(".m2-thumb");
    let thumbT: ReturnType<typeof setTimeout> | null = null;
    add(sbScroll, "scroll", () => {
      const ch = sbScroll.scrollHeight,
        vh = sbScroll.clientHeight;
      if (ch <= vh + 1) return;
      const track = vh - 83 - 24;
      const h = Math.max(40, (track * vh) / ch);
      thumb.style.height = h + "px";
      thumb.style.top = 83 + (track - h) * (sbScroll.scrollTop / (ch - vh)) + "px";
      thumb.classList.add("show");
      if (thumbT) clearTimeout(thumbT);
      thumbT = setTimeout(() => thumb.classList.remove("show"), 900);
    });
    cleanups.push(() => {
      if (thumbT) clearTimeout(thumbT);
    });

    // ── капсула активного таба (компенсация scale контента при твикере) ──
    const panes: Record<string, HTMLElement> = {
      ai: qs(".pane-ai"),
      prod: qs(".pane-prod"),
      ind: qs(".pane-ind"),
      tar: qs(".pane-tar"),
    };
    const tabPill = qs(".tabs .tab-pill");
    function placePill(tab: HTMLElement) {
      const r = tab.getBoundingClientRect();
      const c = tabPill.parentElement!.getBoundingClientRect();
      const k = c.width / tabPill.parentElement!.offsetWidth;
      tabPill.style.left = (r.left - c.left) / k + "px";
      tabPill.style.width = r.width / k + "px";
    }
    placePill(qs(".tabs .tab.active"));
    document.fonts.ready.then(() => {
      if (!alive) return;
      tabPill.style.transition = "none";
      placePill(qs(".tabs .tab.active"));
      void tabPill.offsetWidth;
      tabPill.style.transition = "";
    });
    document.querySelectorAll(".tabs .tab[data-pane]").forEach((tab) => {
      const h = () => {
        if (!tab.classList.contains("active")) {
          placePill(tab as HTMLElement);
          tabPill.classList.remove("squish");
          void tabPill.offsetWidth;
          tabPill.classList.add("squish");
        }
        document.querySelectorAll(".tabs .tab").forEach((t) => t.classList.toggle("active", t === tab));
        const key = (tab as HTMLElement).dataset.pane!;
        document.body.classList.toggle("products", key === "prod");
        document.body.classList.toggle("industry", key === "ind");
        document.body.classList.toggle("tariffs", key === "tar");
        Object.entries(panes).forEach(([kk, el]) => el.setAttribute("aria-hidden", String(kk !== key)));
      };
      tab.addEventListener("click", h);
      cleanups.push(() => tab.removeEventListener("click", h));
    });
    cleanups.push(() => document.body.classList.remove("products", "industry", "tariffs"));

    // ── «мышление» строки задач ──
    const tasksP = qs(".pane-ai .tasks");
    const tasksRowEl = qs(".pane-ai .tasks-row");
    tasksP.textContent = "";
    let tasksCur: HTMLElement | null = null;
    function setTasks(text: string, fin?: boolean) {
      const line = document.createElement("span");
      line.className = "tasks-line" + (fin ? " fin" : "");
      line.textContent = text;
      if (!fin) {
        const dots = document.createElement("i");
        dots.className = "tl-dots";
        dots.innerHTML = "<s>.</s><s>.</s><s>.</s>";
        line.appendChild(dots);
      }
      if (tasksCur) line.classList.add("below");
      tasksP.appendChild(line);
      tasksP.style.width = line.getBoundingClientRect().width + "px";
      if (tasksCur) {
        const prev = tasksCur;
        prev.classList.add("above");
        line.classList.remove("below");
        later(() => prev.remove(), 500);
      }
      tasksCur = line;
    }
    setTasks("Ищу платежи");
    document.fonts.ready.then(() => {
      if (alive && tasksCur) tasksP.style.width = tasksCur.getBoundingClientRect().width + "px";
    });
    later(() => setTasks("Проверяю контрагентов"), 1200);
    later(() => setTasks(TASKS_FINAL, true), 2400);
    later(() => tasksRowEl.classList.add("ai-done"), 2800);

    // ── дропдаун чипсы ──
    const chipWrap = qs(".chip-wrap");
    const chipWork = byId("chipWork");
    const chipDrop = byId("chipDrop");
    function setChipDrop(open: boolean) {
      chipWrap.classList.toggle("open", open);
      chipWork.setAttribute("aria-expanded", String(open));
      chipDrop.setAttribute("aria-hidden", String(!open));
    }
    add(chipWork, "click", (e) => {
      (e as MouseEvent).stopPropagation();
      setChipDrop(!chipWrap.classList.contains("open"));
    });
    add(document, "click", (e) => {
      if (chipWrap.classList.contains("open") && !chipWrap.contains((e as MouseEvent).target as Node))
        setChipDrop(false);
    });

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // перекладка стека при смене состояния из панели
  useEffect(() => {
    layoutRef.current();
  }, [st]);
}
