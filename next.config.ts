import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Верстка использует обычные <img> с путями в /public (не next/image).
  // Линт не блокирует билд во время миграции; типы TS проверяются как обычно.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
