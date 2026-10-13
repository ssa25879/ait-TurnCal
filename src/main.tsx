import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";

const container = document.getElementById("app");

if (!container) {
  throw new Error("#app 요소를 찾을 수 없어요.");
}

createRoot(container).render(
  <StrictMode>
    <TDSMobileAITProvider>
      <App />
    </TDSMobileAITProvider>
  </StrictMode>,
);
