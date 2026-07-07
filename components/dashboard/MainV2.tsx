import { memo } from "react";
import { sidebarV2Inner } from "./htmlPartials";
import Rail from "./Rail";
import DashboardContent from "./DashboardContent";
import V2Behavior from "./V2Behavior";
import NeuroBar from "@/components/neuro/NeuroBar";

// Главная, вариант v2 (форк v1): стек-сайдбар + общий контент + нижняя умная строка.
// Твикер теперь общий (ToolsPanel в layout); menu2.css грузится глобально в layout.
// memo: пропсов нет → рендерится один раз (иначе смена состояния в контексте пере-инжектит
// статичную разметку и стирает JS-выставленные top'ы стека). Контекст-консьюмеры внутри
// (V2Behavior) обновляются независимо.
function MainV2() {
  return (
    <>
      <aside className="sidebar v2" dangerouslySetInnerHTML={{ __html: sidebarV2Inner }} />
      <Rail />
      <DashboardContent />
      <NeuroBar left="324px" right="88px" bottom="40px" />
      <V2Behavior />
    </>
  );
}

export default memo(MainV2);
