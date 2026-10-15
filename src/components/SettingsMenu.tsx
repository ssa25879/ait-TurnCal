import { List, ListRow } from "@toss/tds-mobile";
import { THEMES, type ThemeId } from "../domain/theme";
import type { WeekStart } from "../domain/types";

interface Props {
  /** 근무 패턴이 없으면(패턴 초기화 뒤) null */
  cycleLength: number | null;
  theme: ThemeId;
  weekStart: WeekStart;
  scheduleName: string | null;
  onOpenNames(): void;
  onOpenPattern(): void;
  onOpenDisplay(): void;
  onOpenReset(): void;
}

/** 설정 목록: 이름 · 근무 패턴(draft + [저장]) · 화면 설정(즉시 저장) · 초기화 */
export function SettingsMenu({
  cycleLength,
  theme,
  weekStart,
  scheduleName,
  onOpenNames,
  onOpenPattern,
  onOpenDisplay,
  onOpenReset,
}: Props) {
  const rows = [
    { top: "이름", bottom: scheduleName ?? "설정 안 함", onClick: onOpenNames },
    { top: "근무 패턴", bottom: cycleLength === null ? "등록되지 않음" : `${cycleLength}일 주기`, onClick: onOpenPattern },
    {
      top: "화면 설정",
      bottom: `${THEMES[theme].name} · ${weekStart === "SUN" ? "일요일" : "월요일"} 시작`,
      onClick: onOpenDisplay,
    },
    { top: "초기화", bottom: "전체 데이터 지우기", onClick: onOpenReset },
  ];

  return (
    <section className="settings-menu">
      <h1 className="page-title">설정</h1>
      <List>
        {rows.map((row) => (
          <ListRow
            key={row.top}
            role="button"
            tabIndex={0}
            withArrow
            onClick={row.onClick}
            contents={<ListRow.Texts type="2RowTypeA" top={row.top} bottom={row.bottom} />}
          />
        ))}
      </List>
    </section>
  );
}
