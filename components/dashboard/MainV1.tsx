import { memo } from "react";
import { sidebarV1Inner, spotV1 } from "./htmlPartials";
import Rail from "./Rail";
import DashboardContent from "./DashboardContent";
import V1Behavior from "./V1Behavior";
import NeuroBar from "@/components/neuro/NeuroBar";

// Главная, вариант v1: сайдбар v1 + общий контент + свой Spotlight + нижняя умная строка
// (та же, что и в v2 — тот же .sidebar базовый класс/ширина 308px, поэтому отступы строки
// совпадают с MainV2). memo — защита статичной разметки от пере-инжекта при апдейтах контекста.
function MainV1() {
  return (
    <>
      <aside className="sidebar" dangerouslySetInnerHTML={{ __html: sidebarV1Inner }} />
      <Rail />
      <DashboardContent />
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: spotV1 }} />
      <NeuroBar left="324px" right="88px" bottom="40px" />
      <V1Behavior />
    </>
  );
}

export default memo(MainV1);
