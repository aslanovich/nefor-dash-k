"use client";
import { useCallback, useEffect, useRef } from "react";

/* Звук «клика» — общий для 3D-клавиши (AiKeyButton) и тегов режима-курсора
   (useNeuroBar: клик по блоку / удаление тега). Случайный звук клавиатуры,
   пул Audio на вариант — чтобы быстрые клики не обрезали друг друга. */

const SOUND_ROOT = "/assets/sounds/";
const KEY_SOUND_NAMES = ["key_sound_1", "key_sound_2", "key_sound_3", "key_sound_4"];

export function useClickSound() {
  const poolRef = useRef<Array<{ index: number; pool: HTMLAudioElement[] }> | null>(null);

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
    poolRef.current = soundBanks;

    return () => {
      soundBanks.forEach((bank) => bank.pool.forEach((audio) => audio.pause()));
      poolRef.current = null;
    };
  }, []);

  return useCallback(() => {
    const banks = poolRef.current;
    if (!banks) return;
    const bank = banks[Math.floor(Math.random() * banks.length)];
    const audio = bank.pool[bank.index];
    bank.index = (bank.index + 1) % bank.pool.length;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, []);
}
