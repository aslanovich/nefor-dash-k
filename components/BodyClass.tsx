"use client";
import { useEffect } from "react";

/* Вешает класс на <body> на время жизни роута (снимает при уходе).
   Нужен, т.к. в App Router <body> живёт в root layout и общий для всех роутов,
   а некоторым страницам нужен свой body-класс (например .cur для /current). */
export default function BodyClass({ name }: { name: string }) {
  useEffect(() => {
    const names = name.split(/\s+/).filter(Boolean);
    document.body.classList.add(...names);
    return () => document.body.classList.remove(...names);
  }, [name]);
  return null;
}
