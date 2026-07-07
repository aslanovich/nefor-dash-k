"use client";
import { useV1Page } from "@/lib/useV1Page";

// Оживляет статичную разметку главной (v1): опрашивает document в useEffect.
// Ничего не рендерит — только поведение с cleanup.
export default function V1Behavior() {
  useV1Page();
  return null;
}
