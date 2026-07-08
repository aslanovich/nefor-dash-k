"use client";
import { useRef } from "react";
import { useNeuroBar, NeuroBarOpts } from "./useNeuroBar";
import AiKeyButton from "./AiKeyButton";
import { useBoardScroll } from "./useBoardScroll";
import "@/styles/ai-key.css";
import "@/styles/neuro-bar.css";

/* Умная строка нейропомощника: клавиша (.aik-stage) + пилюля (.nb-pill, разметка по
   Figma node 312:31933/312:31934) + Spotlight (.spot) + фуллскрин-чат (.chat).
   Поведение — в useNeuroBar. Обёртка display:contents не создаёт box → не становится
   containing-block для fixed. */

interface NeuroBarProps extends NeuroBarOpts {
  assetBase?: string;
}

export default function NeuroBar({
  left,
  right,
  bottom,
  assetBase = "/assets/figma/",
}: NeuroBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const keyStageRef = useRef<HTMLDivElement>(null);
  const activateRef = useRef<() => void>(() => {});
  const b = assetBase;
  const f = "/assets/ai-field/";
  useNeuroBar(rootRef, { left, right, bottom, activateRef });
  useBoardScroll(keyStageRef);

  return (
    <div ref={rootRef} style={{ display: "contents" }}>
      {/* ── строка ── */}
      <div className="nbar">
        <div className="nb-key" ref={keyStageRef}>
          <AiKeyButton onActivate={() => activateRef.current()} />
        </div>
        <div className="nb-pill">
          <div className="nb-row1">
            <input
              className="nb-input"
              type="text"
              placeholder="Сделай красиво"
              aria-label="Спросите нейропомощника"
            />
            <span className="nb-voice-hint">
              <img src={`${f}voice-hint.svg`} alt="" width="24" height="24" />
            </span>
            <div className="nb-eq" aria-hidden="true">
              {Array.from({ length: 26 }).map((_, i) => (
                <span className="nb-eq-col" key={i} />
              ))}
            </div>
          </div>
          <div className="nb-row2">
            <button className="nb-clip" type="button" aria-label="Прикрепить файл">
              <img src={`${f}clip.svg`} alt="" width="24" height="24" />
            </button>
            <div className="nb-row2-right">
              <button className="nb-mic" type="button" aria-label="Голосовой ввод">
                <img src={`${f}mic.svg`} alt="" width="24" height="24" />
              </button>
              <button className="nb-picker" type="button" aria-label="Спросить про блок на странице">
                <img src={`${f}cursor-click.svg`} alt="" width="24" height="24" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Spotlight ── */}
      <div className="spot" aria-hidden="true">
        <aside className="spot-menu">
          <div className="spot-logo">
            <i className="glow" />
            <img src={`${b}spotLogo.svg`} alt="" width="40" height="40" />
            <span>Нейропомощник</span>
          </div>
          <nav className="spot-nav">
            <div className="spot-cell dim">
              <span className="ic">
                <img src={`${b}spotHome.svg`} alt="" width="20" height="20" />
              </span>
              <span className="lb">Главная</span>
            </div>
            <div className="spot-cell active">
              <span className="ic">
                <img src={`${b}spotChat.svg`} alt="" width="20" height="20" />
              </span>
              <span className="lb">Чат</span>
            </div>
          </nav>
        </aside>
        <div className="spot-body">
          <div className="spot-gradi">
            <i className="g1" />
            <i className="g2" />
            <i className="g3" />
            <i className="g4" />
          </div>
          <div className="spot-head">
            <button className="spot-hbtn" aria-label="Информация">
              <img src={`${b}spotInfoBtn.svg`} alt="" width="40" height="40" />
            </button>
            <button className="spot-hbtn spot-close" aria-label="Закрыть">
              <img src={`${b}spotCloseBtn.svg`} alt="" width="40" height="40" />
            </button>
          </div>
          <div className="spot-content">
            <div className="spot-hello">
              <h2>
                <span className="dash">—</span> Привет!
              </h2>
              <p>Помогу найти нужный раздел или отвечу на ваши вопросы о банке</p>
            </div>
            <div className="spot-search">
              <div className="spot-input">
                <span className="ic">
                  <img src={`${b}spotClip.svg`} alt="" width="24" height="24" />
                </span>
                <input type="text" placeholder="Спросите что угодно" />
              </div>
              <div className="spot-btns">
                <button className="spot-btn">
                  <img src={`${b}spotBtnMagn.svg`} alt="" width="20" height="23" />
                  Скачай выписку
                </button>
                <button className="spot-btn">
                  <img src={`${b}spotBtnMagn.svg`} alt="" width="20" height="23" />
                  Покажи реквизиты
                </button>
                <button className="spot-btn">
                  <img src={`${b}spotBtnMagn.svg`} alt="" width="20" height="23" />
                  Расскажи про тариф
                </button>
              </div>
            </div>
            <div className="spot-cards">
              <div className="spot-card">
                <p className="t">Популярное</p>
                <div className="rows">
                  <div className="spot-row">
                    <img src={`${b}spotDep.svg`} alt="" width="24" height="24" />
                    <span>Депозиты</span>
                  </div>
                  <div className="spot-row">
                    <img src={`${b}spotRisk.svg`} alt="" width="24" height="24" />
                    <span>Индикатор риска</span>
                  </div>
                  <div className="spot-row">
                    <img src={`${b}spotCalc.svg`} alt="" width="24" height="24" />
                    <span>Бухгалтерия</span>
                  </div>
                </div>
              </div>
              <div className="spot-card">
                <p className="t">История</p>
                <div className="rows">
                  <div className="spot-row">
                    <img src={`${b}spotMagn.svg`} alt="" width="24" height="24" />
                    <span>Дебиторская задолженность с длинным текстом</span>
                  </div>
                  <div className="spot-row">
                    <img src={`${b}spotMagn.svg`} alt="" width="24" height="24" />
                    <span>Деньги сверху</span>
                  </div>
                  <div className="spot-row">
                    <img src={`${b}spotMagn.svg`} alt="" width="24" height="24" />
                    <span>ООО «Ландыш и партнеры»</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Фуллскрин-чат ── */}
      <div className="chat" aria-hidden="true">
        <aside className="chat-menu">
          <div className="chat-logo">
            <img src={`${b}chatLogo.png`} alt="" width="40" height="40" />
            <span>Нейропомощник</span>
          </div>
          <nav className="chat-nav">
            <div className="chat-cell dim">
              <span className="ic">
                <img src={`${b}spotHome.svg`} alt="" width="20" height="20" />
              </span>
              <span className="lb">Главная</span>
            </div>
            <div className="chat-cell active">
              <span className="ic">
                <img src={`${b}spotChat.svg`} alt="" width="20" height="20" />
              </span>
              <span className="lb">Чат</span>
            </div>
          </nav>
        </aside>
        <div className="chat-body">
          <div className="chat-head">
            <button className="chat-hbtn" aria-label="Информация">
              <img src={`${b}spotInfoBtn.svg`} alt="" width="40" height="40" />
            </button>
            <button className="chat-hbtn chat-close" aria-label="Закрыть">
              <img src={`${b}spotCloseBtn.svg`} alt="" width="40" height="40" />
            </button>
          </div>
          <div className="chat-scroll">
            <div className="chat-col">
              <div className="chat-thread" />
            </div>
          </div>
          <div className="chat-footer">
            <div className="chat-foot-inner">
              <div className="chat-input">
                <span className="ic">
                  <img src={`${b}spotClip.svg`} alt="" width="24" height="24" />
                </span>
                <input
                  type="text"
                  placeholder="Спросите что угодно"
                  aria-label="Спросите что угодно"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
