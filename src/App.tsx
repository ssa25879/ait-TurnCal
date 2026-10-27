import { ConfirmDialog } from "@toss/tds-mobile";
import { useInitAds } from "./ads/tossAds";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarReminderScreen } from "./components/CalendarReminderScreen";
import { CalendarScreen } from "./components/CalendarScreen";
import { DayScreen } from "./components/DayScreen";
import { DisplaySettingsScreen } from "./components/DisplaySettingsScreen";
import { EntryEditor, type EntryDraft } from "./components/EntryEditor";
import { LoadError } from "./components/LoadError";
import { NamesScreen } from "./components/NamesScreen";
import { ResetScreen } from "./components/ResetScreen";
import { SettingsMenu } from "./components/SettingsMenu";
import { SettingsScreen } from "./components/SettingsScreen";
import { ShiftLabelsProvider } from "./components/ShiftLabelsContext";
import { ShiftLabelsScreen } from "./components/ShiftLabelsScreen";
import { yearMonthOf, type YearMonth } from "./domain/calendar";
import {
  DEFAULT_REMINDER,
  reminderLabel,
  resolveReminder,
  type ReminderHour,
  type ReminderSetting,
} from "./domain/calendarReminder";
import { applyPatternChange, type ApplyScope, type PatternTimeline } from "./domain/patternHistory";
import type { DayEntry, DayRecord } from "./domain/dayEntries";
import { applyShiftColors, countCustomized, resolveShiftLabels, type StoredShiftLabels } from "./domain/shiftLabels";
import { DEFAULT_THEME, type ThemeId } from "./domain/theme";
import type { WorkPattern } from "./domain/types";
import {
  createOverlayRegistry,
  OverlayBackProvider,
  useCloseOnBack,
} from "./platform/overlayBack";
import { useAnonymousKey } from "./platform/useAnonymousKey";
import { recordPatternSaved } from "./platform/analytics";
import { useBackHandler } from "./platform/useBackHandler";
import { useNavSettingsButton } from "./platform/useNavSettingsButton";
import { useSafeArea } from "./platform/useSafeArea";
import { useToday } from "./platform/useToday";
import { loadEntries, saveEntries, type EntriesByDate } from "./storage/entriesStorage";
import { resetAll, resetDisplay, resetPattern } from "./storage/reset";
import {
  createDefaultSettings,
  loadSettings,
  saveSettings,
  type StoredSettingsV3,
} from "./storage/scheduleStorage";

type View =
  | { kind: "loading" }
  | { kind: "load-error"; reason: string }
  | { kind: "calendar" }
  | { kind: "settings-menu" }
  | { kind: "names"; fromCalendar?: boolean }
  | { kind: "shift-labels" }
  | { kind: "pattern"; fromCalendar?: boolean }
  | { kind: "display" }
  | { kind: "reminder" }
  | { kind: "reset" }
  | { kind: "day"; date: string }
  | { kind: "entry"; date: string; entryId: string | null };

type DisplayPatch = Partial<Pick<StoredSettingsV3, "theme" | "weekStart">>;
type DiscardTarget = { kind: "settings-menu" } | { kind: "calendar" } | { kind: "day"; date: string };

const ENTRIES_BROKEN_NOTICE = "날짜 세부 내용을 불러오지 못했어요. 근무는 패턴대로 보여요.";

function newEntryId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toEntry(draft: EntryDraft, base: { id: string; createdAt: number }): DayEntry {
  const entry: DayEntry = { id: base.id, name: draft.name.trim(), createdAt: base.createdAt };
  if (draft.start) entry.start = draft.start;
  if (draft.start && draft.end) entry.end = draft.end;
  if (draft.memo.trim()) entry.memo = draft.memo;
  if (draft.shift) entry.shift = draft.shift;
  return entry;
}

interface AppProps {
  /** 테마는 TDS Provider 위(Root)에서 적용한다. */
  onThemeChange(theme: ThemeId): void;
}

export function App({ onThemeChange }: AppProps) {
  const [registry] = useState(createOverlayRegistry);
  return (
    <OverlayBackProvider registry={registry}>
      <TurnCal
        hasOpenOverlay={registry.hasOpen}
        closeTopOverlay={registry.closeTop}
        onThemeChange={onThemeChange}
      />
    </OverlayBackProvider>
  );
}

function TurnCal({
  hasOpenOverlay,
  closeTopOverlay,
  onThemeChange,
}: {
  hasOpenOverlay: () => boolean;
  closeTopOverlay: () => void;
  onThemeChange: (theme: ThemeId) => void;
}) {
  useSafeArea();
  useInitAds();
  useAnonymousKey();
  const today = useToday();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [settings, setSettings] = useState<StoredSettingsV3 | null>(null);
  const [days, setDays] = useState<EntriesByDate>({});
  const [entriesBroken, setEntriesBroken] = useState(false);
  const [month, setMonth] = useState<YearMonth>(() => yearMonthOf(today));
  const [dirty, setDirty] = useState(false);
  const [session, setSession] = useState(0);
  const [discard, setDiscard] = useState<DiscardTarget | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);

  const pattern = settings?.pattern ?? null;
  // 설정이 저장돼 있으면 패턴이 없어도(패턴 초기화 뒤) 타임라인이 있다. current가 null이면 패턴 없음이다.
  const timeline: PatternTimeline | null = settings
    ? { current: pattern, history: settings.patternHistory ?? [] }
    : null;

  useEffect(() => {
    onThemeChange(settings?.theme ?? DEFAULT_THEME);
  }, [settings?.theme, onThemeChange]);

  // 근무 유형 이름·약어·색 사용자 정의. 색은 테마처럼 루트 CSS 변수로 넣어 팝업에도 적용한다.
  const shiftLabels = useMemo(() => resolveShiftLabels(settings?.shiftLabels), [settings?.shiftLabels]);
  useEffect(() => {
    applyShiftColors(document.documentElement, shiftLabels);
  }, [shiftLabels]);

  /** 저장소를 읽어 상태에 반영한다. updateView가 false면 화면은 그대로 두고 데이터만 맞춘다. */
  const applyLoaded = useCallback(async (updateView = true) => {
    const [settingsResult, entriesResult] = await Promise.all([loadSettings(), loadEntries()]);
    if (entriesResult.kind === "ok") setDays(entriesResult.days);
    else setDays({});
    setEntriesBroken(entriesResult.kind === "corrupt" || entriesResult.kind === "error");
    if (!updateView) {
      setSettings(settingsResult.kind === "ok" ? settingsResult.settings : null);
      return;
    }
    switch (settingsResult.kind) {
      case "ok":
        setSettings(settingsResult.settings);
        setView({ kind: "calendar" });
        break;
      case "empty":
        // 저장된 설정이 없으면(첫 실행·전체 초기화 뒤 재실행) 기본 설정으로 빈 달력을 연다. 저장하지 않는다.
        setSettings(createDefaultSettings());
        setView({ kind: "calendar" });
        break;
      case "corrupt":
        setSettings(null);
        setView({ kind: "load-error", reason: settingsResult.reason });
        break;
      case "error":
        setSettings(null);
        setView({ kind: "load-error", reason: "기기 저장소를 읽지 못했어요. 앱을 다시 열어 주세요." });
        break;
    }
  }, []);

  useEffect(() => {
    void applyLoaded();
  }, [applyLoaded]);

  const go = (next: View) => {
    setDirty(false);
    setDiscard(null);
    setSession((n) => n + 1);
    setView(next);
  };
  const toCalendar = () => go({ kind: "calendar" });
  const toSettingsMenu = () => go({ kind: "settings-menu" });
  /** 달력의 바로가기로 연 설정 화면은 설정 목록을 거치지 않았으니 뒤로가기·폐기·저장 뒤에 달력으로 돌아간다. */
  const openFromCalendar = (kind: "pattern" | "names") => go({ kind, fromCalendar: true });
  const isFromCalendar = (current: View) =>
    (current.kind === "pattern" || current.kind === "names") && current.fromCalendar === true;
  const toDay = (date: string) => {
    setDayError(null);
    go({ kind: "day", date });
  };

  // 설정 진입은 내비게이션 바 기능 버튼(최대 1개)이며 달력에서만 등록한다. 등록이 안 되는 환경만 하단 버튼을 쓴다.
  const navSettings = useNavSettingsButton(view.kind === "calendar" && settings !== null, () => {
    if (view.kind === "calendar") toSettingsMenu();
  });

  useBackHandler(
    () => ({
      screen: view.kind,
      hasSavedSettings: settings !== null,
      isDirty: dirty,
      hasOverlay: hasOpenOverlay(),
    }),
    {
      closeOverlay: closeTopOverlay,
      toCalendar,
      // 달력의 [근무 패턴 등록하기]로 연 설정 화면은 설정 목록을 거치지 않았으니 달력으로 돌아간다.
      toSettingsMenu: () => (isFromCalendar(view) ? toCalendar() : toSettingsMenu()),
      toDay: () => {
        if (view.kind === "entry") toDay(view.date);
      },
      confirmDiscard: () =>
        setDiscard(
          view.kind === "entry"
            ? { kind: "day", date: view.date }
            : isFromCalendar(view)
              ? { kind: "calendar" }
              : { kind: "settings-menu" },
        ),
    },
  );

  // ---------- 설정 저장 ----------
  const savePattern = async (next: WorkPattern, scope: ApplyScope) => {
    // 적용 범위에 따라 이력을 갱신한다. 저장된 패턴이 없으면(첫 등록·패턴 초기화 후) 적용 범위 없이
    // 새 패턴을 현재 패턴으로 두고, 패턴 초기화 때 남긴 이력은 그대로 유지한다.
    const result = applyPatternChange(timeline, next, scope, today);
    const { patternHistory: _previousHistory, ...rest } = settings ?? createDefaultSettings();
    const updated: StoredSettingsV3 = {
      ...rest,
      pattern: result.current,
      ...(result.history.length > 0 ? { patternHistory: result.history } : {}),
    };
    await saveSettings(updated);
    recordPatternSaved();
    setSettings(updated);
    toCalendar();
  };

  const saveNames = async (names: { userName: string | null; scheduleName: string | null }) => {
    if (!settings) return;
    const updated = { ...settings, ...names };
    await saveSettings(updated);
    setSettings(updated);
    if (isFromCalendar(view)) toCalendar();
    else toSettingsMenu();
  };

  /** 근무 유형 사용자 정의. 비어 있으면 필드를 빼서 기본값으로 돌린다. */
  const writeShiftLabels = async (shiftLabels: StoredShiftLabels | undefined) => {
    if (!settings) return;
    const { shiftLabels: _previous, ...rest } = settings;
    const updated: StoredSettingsV3 = shiftLabels ? { ...rest, shiftLabels } : rest;
    await saveSettings(updated);
    setSettings(updated);
  };

  const saveShiftLabels = async (shiftLabels: StoredShiftLabels | undefined) => {
    await writeShiftLabels(shiftLabels);
    toSettingsMenu();
  };

  /** 기본값으로 되돌리기는 확인 창 뒤 바로 저장하고 화면에 머문다(편집 중이던 내용도 기본값으로). */
  const resetShiftLabels = () => writeShiftLabels(undefined);

  /** 테마·주 시작 요일 공통: 낙관적으로 반영하고, 저장에 실패하면 이전 값으로 되돌린다. */
  const updateDisplaySettings = async (patch: DisplayPatch) => {
    if (!settings) return;
    const previous = settings;
    const next: StoredSettingsV3 = { ...settings, ...patch };
    if (next.theme === previous.theme && next.weekStart === previous.weekStart) return;
    setSettings(next);
    setDisplayError(null);
    try {
      await saveSettings(next);
    } catch {
      setSettings(previous);
      setDisplayError("화면 설정을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  };

  /** 캘린더 알림: 화면 설정처럼 낙관적으로 반영하고, 저장에 실패하면 이전 값으로 되돌린다. */
  const updateReminder = async (patch: Partial<ReminderSetting>) => {
    if (!settings) return;
    const previous = settings;
    const current = resolveReminder(settings);
    const next = { ...current, ...patch };
    if (next.enabled === current.enabled && next.hour === current.hour) return;
    const { icsReminderEnabled: _enabled, icsReminderHour: _hour, ...rest } = settings;
    const updated: StoredSettingsV3 = { ...rest };
    if (!next.enabled) updated.icsReminderEnabled = false;
    if (next.hour !== DEFAULT_REMINDER.hour) updated.icsReminderHour = next.hour;
    setSettings(updated);
    setReminderError(null);
    try {
      await saveSettings(updated);
    } catch {
      setSettings(previous);
      setReminderError("캘린더 알림을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  };

  // ---------- 초기화 (실패하면 예외를 ResetAction이 받아 그 화면에서 안내한다) ----------
  const runResetAll = async () => {
    try {
      await resetAll();
    } catch (error) {
      // 일부만 지워졌을 수 있으니 화면은 그대로 두고 실제 저장 상태로 데이터를 맞춘다.
      await applyLoaded(false);
      throw error;
    }
    // 저장소는 비웠고 기본 설정은 메모리에만 둔다(저장하지 않음). 재실행해도 같은 빈 달력이 열린다.
    setSettings(createDefaultSettings());
    setDays({});
    setEntriesBroken(false);
    setMonth(yearMonthOf(today));
    toCalendar();
  };

  /** 편집 중이던 내용도 함께 버리고 빈 달력으로 간다(확인 창이 폐기 확인을 대신한다). */
  const runResetPattern = async () => {
    if (!settings) return;
    setSettings(await resetPattern(settings));
    toCalendar();
  };

  /** 저장에 성공했을 때만 반영하고 화면 설정에 머문다. */
  const runResetDisplay = async () => {
    if (!settings) return;
    setSettings(await resetDisplay(settings));
    setDisplayError(null);
  };

  // ---------- 세부 내용 저장 ----------
  const writeDays = async (next: EntriesByDate) => {
    const saved = await saveEntries(next);
    setDays(saved);
  };

  const updateDay = (date: string, update: (record: DayRecord) => DayRecord): EntriesByDate => ({
    ...days,
    [date]: update(days[date] ?? { items: [] }),
  });

  const saveEntry = async (date: string, entryId: string | null, draft: EntryDraft) => {
    await writeDays(
      updateDay(date, (record) => {
        const existing = entryId ? record.items.find((item) => item.id === entryId) : undefined;
        const entry = toEntry(draft, existing ?? { id: newEntryId(), createdAt: Date.now() });
        const items = existing
          ? record.items.map((item) => (item.id === entryId ? entry : item))
          : [...record.items, entry];
        return { ...record, items };
      }),
    );
    toDay(date);
  };

  const deleteEntry = async (date: string, entryId: string) => {
    await writeDays(
      updateDay(date, (record) => {
        const next: DayRecord = { items: record.items.filter((item) => item.id !== entryId) };
        if (record.shiftSourceId && record.shiftSourceId !== entryId) next.shiftSourceId = record.shiftSourceId;
        return next;
      }),
    );
    toDay(date);
  };

  const selectShiftSource = async (date: string, entryId: string) => {
    setDayError(null);
    try {
      await writeDays(updateDay(date, (record) => ({ ...record, shiftSourceId: entryId })));
    } catch {
      setDayError("그날 근무를 바꾸지 못했어요. 다시 시도해 주세요.");
    }
  };

  const startFreshEntries = async () => {
    setDayError(null);
    try {
      await writeDays({});
      setEntriesBroken(false);
    } catch {
      setDayError("세부 내용을 비우지 못했어요. 다시 시도해 주세요.");
    }
  };

  const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  const discardAndLeave = () => {
    if (!discard) return;
    if (discard.kind === "day") toDay(discard.date);
    else if (discard.kind === "calendar") toCalendar();
    else toSettingsMenu();
  };

  return (
    <ShiftLabelsProvider labels={shiftLabels}>
      <main className="app">
        {view.kind === "load-error" && (
          <LoadError reason={view.reason} onReset={() => go({ kind: "pattern" })} />
        )}
        {view.kind === "pattern" && (
          <SettingsScreen
            key={session}
            saved={pattern}
            timeline={pattern || (timeline?.history.length ?? 0) > 0 ? timeline : null}
            today={today}
            onSave={savePattern}
            onDirtyChange={handleDirtyChange}
            onResetPattern={pattern ? runResetPattern : undefined}
          />
        )}
        {view.kind === "settings-menu" && settings && (
          <SettingsMenu
            cycleLength={pattern?.cycle.length ?? null}
            theme={settings.theme}
            weekStart={settings.weekStart}
            scheduleName={settings.scheduleName}
            customizedShiftCount={countCustomized(settings.shiftLabels)}
            reminderLabel={reminderLabel(resolveReminder(settings))}
            onOpenNames={() => go({ kind: "names" })}
            onOpenPattern={() => go({ kind: "pattern" })}
            onOpenShiftLabels={() => go({ kind: "shift-labels" })}
            onOpenDisplay={() => {
              setDisplayError(null);
              go({ kind: "display" });
            }}
            onOpenReminder={() => {
              setReminderError(null);
              go({ kind: "reminder" });
            }}
            onOpenReset={() => go({ kind: "reset" })}
          />
        )}
        {view.kind === "names" && settings && (
          <NamesScreen
            key={session}
            userName={settings.userName}
            scheduleName={settings.scheduleName}
            onSave={saveNames}
            onDirtyChange={handleDirtyChange}
          />
        )}
        {view.kind === "shift-labels" && settings && (
          <ShiftLabelsScreen
            key={session}
            saved={settings.shiftLabels}
            onSave={saveShiftLabels}
            onReset={resetShiftLabels}
            onDirtyChange={handleDirtyChange}
          />
        )}
        {view.kind === "display" && settings && (
          <DisplaySettingsScreen
            theme={settings.theme}
            weekStart={settings.weekStart}
            error={displayError}
            onThemeChange={(theme) => void updateDisplaySettings({ theme })}
            onWeekStartChange={(weekStart) => void updateDisplaySettings({ weekStart })}
            onReset={runResetDisplay}
          />
        )}
        {view.kind === "reminder" && settings && (
          <CalendarReminderScreen
            reminder={resolveReminder(settings)}
            error={reminderError}
            onEnabledChange={(enabled) => void updateReminder({ enabled })}
            onHourChange={(hour: ReminderHour) => void updateReminder({ hour })}
          />
        )}
        {view.kind === "reset" && <ResetScreen key={session} onResetAll={runResetAll} />}
        {view.kind === "calendar" && settings && timeline && (
          <CalendarScreen
            timeline={timeline}
            weekStart={settings.weekStart}
            today={today}
            month={month}
            onMonthChange={setMonth}
            userName={settings.userName}
            scheduleName={settings.scheduleName}
            days={days}
            entriesNotice={entriesBroken ? ENTRIES_BROKEN_NOTICE : null}
            reminder={resolveReminder(settings)}
            onSelectDate={toDay}
            showSettingsButton={navSettings === "failed"}
            onOpenSettings={toSettingsMenu}
            onRegisterPattern={() => openFromCalendar("pattern")}
            onEditPattern={() => openFromCalendar("pattern")}
            onEditNames={() => openFromCalendar("names")}
          />
        )}
        {view.kind === "day" && timeline && (
          <DayScreen
            date={view.date}
            timeline={timeline}
            day={days[view.date]}
            entriesBroken={entriesBroken}
            error={dayError}
            onAdd={() => go({ kind: "entry", date: view.date, entryId: null })}
            onOpenEntry={(entryId) => go({ kind: "entry", date: view.date, entryId })}
            onSelectShiftSource={(entryId) => void selectShiftSource(view.date, entryId)}
            onStartFresh={() => void startFreshEntries()}
          />
        )}
        {view.kind === "entry" && (
          <EntryEditor
            key={session}
            date={view.date}
            entry={view.entryId ? days[view.date]?.items.find((item) => item.id === view.entryId) ?? null : null}
            onSave={(draft) => saveEntry(view.date, view.entryId, draft)}
            onDelete={() => (view.entryId ? deleteEntry(view.date, view.entryId) : Promise.resolve())}
            onDirtyChange={handleDirtyChange}
          />
        )}
        <DiscardDialog open={discard !== null} onCancel={() => setDiscard(null)} onDiscard={discardAndLeave} />
      </main>
    </ShiftLabelsProvider>
  );
}

function DiscardDialog({
  open,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  useCloseOnBack(open, onCancel);
  return (
    <ConfirmDialog
      open={open}
      title="변경한 내용을 버릴까요?"
      description="저장하지 않은 변경은 사라져요."
      onClose={onCancel}
      cancelButton={
        <ConfirmDialog.CancelButton onClick={onCancel}>계속 편집하기</ConfirmDialog.CancelButton>
      }
      confirmButton={
        <ConfirmDialog.ConfirmButton onClick={onDiscard}>버리기</ConfirmDialog.ConfirmButton>
      }
    />
  );
}
