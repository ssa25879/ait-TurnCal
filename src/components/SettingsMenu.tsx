import { List, ListRow } from "@toss/tds-mobile";
import { THEMES, type ThemeId } from "../domain/theme";
import type { WeekStart } from "../domain/types";

interface Props {
  cycleLength: number;
  theme: ThemeId;
  weekStart: WeekStart;
  onOpenPattern(): void;
  onOpenDisplay(): void;
}

/** 설정 목록: 근무 패턴(draft + [저장])과 화면 설정(즉시 저장)을 나눠 들어간다. */
export function SettingsMenu({ cycleLength, theme, weekStart, onOpenPattern, onOpenDisplay }: Props) {
  return (
    <section className="settings-menu">
      <h1 className="page-title">설정</h1>
      <List>
        <ListRow
          role="button"
          tabIndex={0}
          withArrow
          onClick={onOpenPattern}
          contents={
            <ListRow.Texts type="2RowTypeA" top="근무 패턴" bottom={`${cycleLength}일 주기`} />
          }
        />
        <ListRow
          role="button"
          tabIndex={0}
          withArrow
          onClick={onOpenDisplay}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="화면 설정"
              bottom={`${THEMES[theme].name} · ${weekStart === "SUN" ? "일요일" : "월요일"} 시작`}
            />
          }
        />
      </List>
    </section>
  );
}
