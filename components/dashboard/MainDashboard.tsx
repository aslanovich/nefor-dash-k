"use client";
import { useTools } from "@/components/tools/ToolsProvider";
import MainV1 from "./MainV1";
import MainV2 from "./MainV2";

// Главная (/): вариант v1/v2 выбирается тогглом в панели tools (контекст).
// Смена варианта — без смены роута (не отдельная страница, требование #3).
export default function MainDashboard() {
  const { variant } = useTools();
  return variant === "v1" ? <MainV1 /> : <MainV2 />;
}
