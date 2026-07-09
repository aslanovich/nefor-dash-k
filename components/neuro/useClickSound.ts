"use client";
import { useCallback, useEffect, useRef } from "react";
import { useTools } from "@/components/tools/ToolsProvider";

/* Звук «клика» — общий для 3D-клавиши (AiKeyButton) и тегов режима-курсора
   (useNeuroBar: клик по блоку / удаление тега). Стандартный режим — случайный
   звук клавиатуры (пул на вариант, чтобы быстрые клики не обрезали друг друга);
   пасхальный — короткий крик петуха. Длинный зацикленный крик при перетаскивании
   клавиши — отдельная, локальная для AiKeyButton логика (тут не нужна). */

const SOUND_ROOT = "/assets/sounds/";
const KEY_SOUND_NAMES = ["key_sound_1", "key_sound_2", "key_sound_3", "key_sound_4"];

export function useClickSound() {
  const { soundMode } = useTools();
  const soundModeRef = useRef(soundMode);
  soundModeRef.current = soundMode;

  const poolRef = useRef<{
    soundBanks: Array<{ index: number; pool: HTMLAudioElement[] }>;
    cockShort: HTMLAudioElement;
  } | null>(null);

  useEffect(() => {
    const canOgg = document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"');
    const ext = canOgg ? "ogg" : "mp3";
    const soundBanks = KEY_SOUND_NAMES.map((name) => ({
      index: 0,
      pool: Array.from({ length: 3 }, () => {
        const audio = new Audio(`${SOUND_ROOT}${name}.${ext}`);
        audio.preload = "auto";
        return audio;
      }),
    }));
    const cockShort = new Audio(`${SOUND_ROOT}cock_short_sound.${ext}`);
    cockShort.preload = "auto";
    poolRef.current = { soundBanks, cockShort };

    return () => {
      soundBanks.forEach((bank) => bank.pool.forEach((audio) => audio.pause()));
      cockShort.pause();
      poolRef.current = null;
    };
  }, []);

  return useCallback(() => {
    const pool = poolRef.current;
    if (!pool) return;
    if (soundModeRef.current === "easter") {
      pool.cockShort.currentTime = 0;
      pool.cockShort.play().catch(() => {});
      return;
    }
    const bank = pool.soundBanks[Math.floor(Math.random() * pool.soundBanks.length)];
    const audio = bank.pool[bank.index];
    bank.index = (bank.index + 1) % bank.pool.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);
}
