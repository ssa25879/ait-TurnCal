import aitDevtools from "@apps-in-toss/devtools/unplugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 개발 서버에서는 SDK API를 mock으로 대체하고 Devtools 패널을 띄운다.
  // production 빌드에서는 플러그인이 mock·패널을 자동으로 건너뛴다.
  plugins: [aitDevtools.vite(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
