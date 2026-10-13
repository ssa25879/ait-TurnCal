import { SegmentedControl } from "@toss/tds-mobile";
import { THEME_IDS, THEMES, type ThemeId } from "../domain/theme";
import type { WeekStart } from "../domain/types";
import { ResetAction } from "./ResetAction";

interface Props {
  theme: ThemeId;
  weekStart: WeekStart;
  error: string | null;
  onThemeChange(theme: ThemeId): void;
  onWeekStartChange(weekStart: WeekStart): void;
  onReset(): Promise<void>;
}

/** 화면 설정. 선택은 [저장] 없이 바로 저장되고 앱에 반영된다. */
export function DisplaySettingsScreen({
  theme,
  weekStart,
  error,
  onThemeChange,
  onWeekStartChange,
  onReset,
}: Props) {
  return (
    <section className="display-settings">
      <h1 className="page-title">화면 설정</h1>

      <section className="section">
        <h2 className="section-title">테마 색</h2>
        <div className="theme-options" role="radiogroup" aria-label="테마 색">
          {THEME_IDS.map((id) => {
            const selected = id === theme;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`theme-option${selected ? " is-selected" : ""}`}
                onClick={() => onThemeChange(id)}
              >
                <span
                  className="theme-swatch"
                  style={{ background: THEMES[id].primary }}
                  aria-hidden="true"
                />
                <span className="theme-name">{THEMES[id].name}</span>
                {selected && <span className="theme-check">선택됨</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">달력</h2>
        <p className="section-desc">한 주를 시작할 요일을 골라 주세요.</p>
        <SegmentedControl
          size="small"
          value={weekStart}
          onChange={(value) => {
            if (value === "SUN" || value === "MON") onWeekStartChange(value);
          }}
        >
          <SegmentedControl.Item value="SUN">일요일 시작</SegmentedControl.Item>
          <SegmentedControl.Item value="MON">월요일 시작</SegmentedControl.Item>
        </SegmentedControl>
      </section>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <ResetAction
        title="화면 설정 초기화"
        description="테마를 인디고, 주 시작 요일을 일요일로 되돌려요. 다른 데이터는 그대로예요."
        confirm="화면 설정을 초기화할까요?"
        onReset={onReset}
      />
    </section>
  );
}
