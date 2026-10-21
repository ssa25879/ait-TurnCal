import { Switch } from "@toss/tds-mobile";
import { DEFAULT_REMINDER_HOUR, hourLabel, REMINDER_HOURS, type ReminderHour, type ReminderSetting } from "../domain/calendarReminder";

interface Props {
  reminder: ReminderSetting;
  error: string | null;
  onEnabledChange(enabled: boolean): void;
  onHourChange(hour: ReminderHour): void;
}

/** 캘린더 파일 알림. 토글·시각은 [저장] 없이 바로 저장된다. 꺼도 고른 시각은 남는다. */
export function CalendarReminderScreen({ reminder, error, onEnabledChange, onHourChange }: Props) {
  const { enabled, hour } = reminder;
  return (
    <section className="reminder-settings">
      <h1 className="page-title">캘린더 알림</h1>

      <label className="reminder-toggle">
        <span className="reminder-toggle-text">캘린더 파일에 알림 넣기</span>
        <Switch
          checked={enabled}
          aria-label="캘린더 파일에 알림 넣기"
          onChange={(_event, checked) => onEnabledChange(checked)}
        />
      </label>

      <p className="section-desc">
        보낸 캘린더 파일을 캘린더 앱에 추가하면, 주간·오후·야간·당직 전날에 캘린더 앱이 알림을 울려요. 비번·휴무에는
        넣지 않아요.
      </p>
      <p className="section-desc">이미 추가한 일정에는 바뀐 설정이 반영되지 않아요. 파일을 다시 보내 주세요.</p>

      <section className="section">
        <h2 className="section-title">알림 시각</h2>
        <div
          className={`theme-options reminder-hours${enabled ? "" : " is-disabled"}`}
          role="radiogroup"
          aria-label="알림 시각"
          aria-disabled={!enabled}
        >
          {REMINDER_HOURS.map((value) => {
            const selected = value === hour;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!enabled}
                className={`theme-option${selected ? " is-selected" : ""}`}
                onClick={() => onHourChange(value)}
              >
                <span className="theme-name">
                  {hourLabel(value)}
                  {value === DEFAULT_REMINDER_HOUR && <span className="reminder-default"> (기본)</span>}
                </span>
                {selected && <span className="theme-check">선택됨</span>}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
