import { railInner } from "./htmlPartials";

// Кружки справа (fixed) — общие для v1 и v2. Статичная вёрстка (byte-perfect перенос).
export default function Rail() {
  return <div className="rail" dangerouslySetInnerHTML={{ __html: railInner }} />;
}
