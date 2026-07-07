import { memo } from "react";
import { sidebarV1Inner, spotV1 } from "./htmlPartials";
import Rail from "./Rail";
import DashboardContent from "./DashboardContent";
import V1Behavior from "./V1Behavior";

// Главная, вариант v1: сайдбар v1 + общий контент + свой Spotlight (без нижней строки).
// memo — см. MainV2 (защита статичной разметки от пере-инжекта при апдейтах контекста).
function MainV1() {
  return (
    <>
      <aside className="sidebar" dangerouslySetInnerHTML={{ __html: sidebarV1Inner }} />
      <Rail />
      <DashboardContent />
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: spotV1 }} />
      <V1Behavior />
    </>
  );
}

export default memo(MainV1);
