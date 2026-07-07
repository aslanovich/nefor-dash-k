import { contentInner } from "./htmlPartials";

// Контентная колонка (табы/hero/панели/баннеры/онбординг/фид) — БАЙТ-В-БАЙТ одна и та же
// для v1 и v2 (подтверждено диффом оригиналов). Статичная вёрстка.
export default function DashboardContent() {
  return <main dangerouslySetInnerHTML={{ __html: contentInner }} />;
}
