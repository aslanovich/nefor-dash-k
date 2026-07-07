"use client";
import { useEffect } from "react";

/* Поведение главной (v1) — порт инлайн-скрипта index.html 1:1.
   Разметка инжектится в DOM (dangerouslySetInnerHTML), здесь — оживление:
   бургер/AI-вид/Spotlight, растяжение AI-меню, капсула табов, скрытие кредита,
   мультибанк, «мышление» строки задач, дропдаун чипсы.
   Все глобальные слушатели и таймеры снимаются в cleanup (StrictMode/маршруты).

   tasksFinal захардкожен (а не читается из DOM), иначе повторный прогон эффекта
   в StrictMode прочитал бы уже очищенный/промежуточный текст. */

const TASKS_FINAL =
  "У вас 15 задач, из них 4 требуют реакции. В тарифах заканчивается лимит на операции. Появились подсказки по оптимизации расходов. Еще 2 новых задания — настроить терминал и защиту от блокировок";

export function useV1Page() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };
    let alive = true;

    const sb = document.querySelector(".sidebar") as HTMLElement;
    const sbBurger = document.getElementById("sbBurger") as HTMLElement;
    if (!sb || !sbBurger) return;

    const on = <K extends keyof DocumentEventMap>(
      target: Window | Document | HTMLElement,
      type: K,
      handler: (e: DocumentEventMap[K]) => void
    ) => {
      target.addEventListener(type as string, handler as EventListener);
      cleanups.push(() =>
        target.removeEventListener(type as string, handler as EventListener)
      );
    };

    // ── бургер: обычный вид разворачивает второе крыло; AI-вид поднимает Spotlight ──
    const onBurger1 = () => {
      if (sb.classList.contains("ai")) return;
      const open = sb.classList.toggle("open");
      sbBurger.setAttribute("aria-expanded", String(open));
      sbBurger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    };
    on(sbBurger, "click", onBurger1);

    const sbOpts = document.querySelectorAll(".sb-toggle-opt");
    function setSbAiMode(ai: boolean) {
      sbOpts.forEach((o) =>
        o.classList.toggle("active", (o as HTMLElement).dataset.mode === "ai" === ai)
      );
      sb.classList.toggle("ai", ai);
      if (ai && sb.classList.contains("open")) {
        sb.classList.remove("open");
        sbBurger.setAttribute("aria-expanded", "false");
      }
      (document.querySelector(".sb-ai") as HTMLElement).setAttribute("aria-hidden", String(!ai));
    }
    sbOpts.forEach((opt) => {
      const h = () => setSbAiMode((opt as HTMLElement).dataset.mode === "ai");
      opt.addEventListener("click", h);
      cleanups.push(() => opt.removeEventListener("click", h));
    });
    // клик по AI-сводке (заголовок + строка задач) включает AI-вид меню
    document.querySelectorAll(".pane-ai .hello, .pane-ai .tasks-row").forEach((el) => {
      const h = () => setSbAiMode(true);
      el.addEventListener("click", h);
      cleanups.push(() => el.removeEventListener("click", h));
    });

    // ── Spotlight: стрелки разворота (бургер в AI-виде) поднимают панель снизу ──
    const spot = document.querySelector(".spot") as HTMLElement;
    function setSpot(open: boolean) {
      spot.classList.toggle("open", open);
      spot.setAttribute("aria-hidden", String(!open));
    }
    const onBurger2 = () => {
      if (sb.classList.contains("ai")) setSpot(true);
    };
    on(sbBurger, "click", onBurger2);
    const spotCloseEl = spot.querySelector(".spot-close") as HTMLElement;
    const onSpotClose = () => setSpot(false);
    spotCloseEl.addEventListener("click", onSpotClose);
    cleanups.push(() => spotCloseEl.removeEventListener("click", onSpotClose));
    on(document, "keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape") setSpot(false);
    });

    // ── растяжение AI-меню за правую грань: 428…700px ──
    const resizeEl = document.querySelector(".sb-resize") as HTMLElement;
    const onResizeDown = (ev: MouseEvent) => {
      ev.preventDefault();
      const startX = ev.clientX;
      const startW = sb.getBoundingClientRect().width;
      sb.classList.add("dragging");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      const move = (e: MouseEvent) => {
        const w = Math.min(700, Math.max(428, startW + e.clientX - startX));
        sb.style.setProperty("--sb-ai-w", w + "px");
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        sb.classList.remove("dragging");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      cleanups.push(up);
    };
    resizeEl.addEventListener("mousedown", onResizeDown);
    cleanups.push(() => resizeEl.removeEventListener("mousedown", onResizeDown));

    // ── скользящая капсула активного таба ──
    const panes: Record<string, HTMLElement> = {
      ai: document.querySelector(".pane-ai") as HTMLElement,
      prod: document.querySelector(".pane-prod") as HTMLElement,
      ind: document.querySelector(".pane-ind") as HTMLElement,
      tar: document.querySelector(".pane-tar") as HTMLElement,
    };
    const tabPill = document.querySelector(".tabs .tab-pill") as HTMLElement;
    function placePill(tab: HTMLElement) {
      const r = tab.getBoundingClientRect();
      const c = tabPill.parentElement!.getBoundingClientRect();
      tabPill.style.left = r.left - c.left + "px";
      tabPill.style.width = r.width + "px";
    }
    placePill(document.querySelector(".tabs .tab.active") as HTMLElement);
    document.fonts.ready.then(() => {
      if (!alive) return;
      tabPill.style.transition = "none";
      placePill(document.querySelector(".tabs .tab.active") as HTMLElement);
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
        document
          .querySelectorAll(".tabs .tab")
          .forEach((t) => t.classList.toggle("active", t === tab));
        const key = (tab as HTMLElement).dataset.pane!;
        document.body.classList.toggle("products", key === "prod");
        document.body.classList.toggle("industry", key === "ind");
        document.body.classList.toggle("tariffs", key === "tar");
        Object.entries(panes).forEach(([k, el]) =>
          el.setAttribute("aria-hidden", String(k !== key))
        );
      };
      tab.addEventListener("click", h);
      cleanups.push(() => tab.removeEventListener("click", h));
    });
    // сброс body-классов панелей при уходе с роута
    cleanups.push(() => {
      document.body.classList.remove("products", "industry", "tariffs");
    });

    // ── клик по кредиту прячет ячейку ──
    const creditEl = document.querySelector(".sb-credit") as HTMLElement;
    const onCredit = () => sb.classList.add("no-credit");
    creditEl.addEventListener("click", onCredit);
    cleanups.push(() => creditEl.removeEventListener("click", onCredit));

    // ── мультибанк: клик по балансу раскрывает остатки по банкам ──
    const bankview = document.querySelector(".sb-bankview") as HTMLElement;
    function setBanks(open: boolean) {
      sb.classList.toggle("banks", open);
      bankview.setAttribute("aria-hidden", String(!open));
    }
    const mbEl = document.querySelector(".sb-multibank") as HTMLElement;
    const onMb = () => setBanks(!sb.classList.contains("banks"));
    mbEl.addEventListener("click", onMb);
    cleanups.push(() => mbEl.removeEventListener("click", onMb));
    const backEl = document.querySelector(".sb-back") as HTMLElement;
    const onBack = () => setBanks(false);
    backEl.addEventListener("click", onBack);
    cleanups.push(() => backEl.removeEventListener("click", onBack));

    // ── «мышление» строки задач: Ищу платежи → Проверяю контрагентов → финал ──
    const tasksP = document.querySelector(".pane-ai .tasks") as HTMLElement;
    const tasksRowEl = document.querySelector(".pane-ai .tasks-row") as HTMLElement;
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

    // ── дропдаун чипсы «Дела в работе» ──
    const chipWrap = document.querySelector(".chip-wrap") as HTMLElement;
    const chipWork = document.getElementById("chipWork") as HTMLElement;
    const chipDrop = document.getElementById("chipDrop") as HTMLElement;
    function setChipDrop(open: boolean) {
      chipWrap.classList.toggle("open", open);
      chipWork.setAttribute("aria-expanded", String(open));
      chipDrop.setAttribute("aria-hidden", String(!open));
    }
    const onChipWork = (e: MouseEvent) => {
      e.stopPropagation();
      setChipDrop(!chipWrap.classList.contains("open"));
    };
    chipWork.addEventListener("click", onChipWork as EventListener);
    cleanups.push(() => chipWork.removeEventListener("click", onChipWork as EventListener));
    on(document, "click", (e) => {
      if (chipWrap.classList.contains("open") && !chipWrap.contains(e.target as Node))
        setChipDrop(false);
    });

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
    };
  }, []);
}
