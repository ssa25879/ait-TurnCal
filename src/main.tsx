import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, DEFAULT_THEME, THEMES, type ThemeId } from "./domain/theme";
import "./style.css";

/** 테마를 TDS Provider 위에 두어 CSS 강조색과 TDS 컴포넌트 색을 같은 값으로 구동한다. */
function Root() {
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);

  return (
    <TDSMobileAITProvider brandPrimaryColor={THEMES[theme].primary}>
      <App onThemeChange={setTheme} />
    </TDSMobileAITProvider>
  );
}

const container = document.getElementById("app");

if (!container) {
  throw new Error("#app 요소를 찾을 수 없어요.");
}

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
