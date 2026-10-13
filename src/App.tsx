import { ConfirmDialog } from "@toss/tds-mobile";
import { useInitAds } from "./ads/tossAds";
import { useCallback, useEffect, useState } from "react";
import { CalendarScreen } from "./components/CalendarScreen";
import { DayScreen } from "./components/DayScreen";
import { DisplaySettingsScreen } from "./components/DisplaySettingsScreen";
import { EntryEditor, type EntryDraft } from "./components/EntryEditor";
import { LoadError } from "./components/LoadError";
import { NamesScreen } from "./components/NamesScreen";
import { ResetScreen } from "./components/ResetScreen";
import { SettingsMenu } from "./components/SettingsMenu";
import { SettingsScreen } from "./components/SettingsScreen";
import { SetupIntro } from "./components/SetupIntro";
import { yearMonthOf, type YearMonth } from "./domain/calendar";
import type { DayEntry, DayRecord } from "./domain/dayEntries";
import { DEFAULT_THEME, type ThemeId } from "./domain/theme";
import type { WorkPattern } from "./domain/types";
import {
  createOverlayRegistry,
  OverlayBackProvider,
  useCloseOnBack,
} from "./platform/overlayBack";
import { useBackHandler } from "./platform/useBackHandler";
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
  | { kind: "setup-intro" }
  | { kind: "load-error"; reason: string }
  | { kind: "calendar" }
  | { kind: "settings-menu" }
  | { kind: "names" }
  | { kind: "pattern" }
  | { kind: "display" }
  | { kind: "reset" }
  | { kind: "day"; date: string }
  | { kind: "entry"; date: string; entryId: string | null };

type DisplayPatch = Partial<Pick<StoredSettingsV3, "theme" | "weekStart">>;
type DiscardTarget = { kind: "settings-menu" } | { kind: "day"; date: string };

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
  const [dayError, setDayError] = useState<string | null>(null);

  const pattern = settings?.pattern ?? null;

  useEffect(() => {
    onThemeChange(settings?.theme ?? DEFAULT_THEME);
  }, [settings?.theme, onThemeChange]);

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
        setView(settingsResult.settings.pattern ? { kind: "calendar" } : { kind: "setup-intro" });
        break;
      case "empty":
        setSettings(null);
        setView({ kind: "setup-intro" });
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
  const toDay = (date: string) => {
    setDayError(null);
    go({ kind: "day", date });
  };

  useBackHandler(
    () => ({
      screen: view.kind,
      hasSavedSettings: pattern !== null,
      isDirty: dirty,
      hasOverlay: hasOpenOverlay(),
    }),
    {
      closeOverlay: closeTopOverlay,
      toCalendar,
      toSettingsMenu,
      toDay: () => {
        if (view.kind === "entry") toDay(view.date);
      },
      confirmDiscard: () =>
        setDiscard(view.kind === "entry" ? { kind: "day", date: view.date } : { kind: "settings-menu" }),
    },
  );

  // ---------- 설정 저장 ----------
  const savePattern = async (next: WorkPattern) => {
    const updated: StoredSettingsV3 = { ...(settings ?? createDefaultSettings()), pattern: next };
    await saveSettings(updated);
    setSettings(updated);
    toCalendar();
  };

  const saveNames = async (names: { userName: string | null; scheduleName: string | null }) => {
    if (!settings) return;
    const updated = { ...settings, ...names };
    await saveSettings(updated);
    setSettings(updated);
    toSettingsMenu();
  };

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

  // ---------- 초기화 (실패하면 예외를 ResetAction이 받아 그 화면에서 안내한다) ----------
  const runResetAll = async () => {
    try {
      await resetAll();
    } catch (error) {
      // 일부만 지워졌을 수 있으니 화면은 그대로 두고 실제 저장 상태로 데이터를 맞춘다.
      await applyLoaded(false);
      throw error;
    }
    setSettings(null);
    setDays({});
    setEntriesBroken(false);
    setMonth(yearMonthOf(today));
    go({ kind: "setup-intro" });
  };

  /** 편집 중이던 내용도 함께 버리고 등록 안내로 간다(확인 창이 폐기 확인을 대신한다). */
  const runResetPattern = async () => {
    if (!settings) return;
    setSettings(await resetPattern(settings));
    go({ kind: "setup-intro" });
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
    else toSettingsMenu();
  };

  return (
    <main className="app">
      {view.kind === "setup-intro" && <SetupIntro onStart={() => go({ kind: "pattern" })} />}
      {view.kind === "load-error" && (
        <LoadError reason={view.reason} onReset={() => go({ kind: "pattern" })} />
      )}
      {view.kind === "pattern" && (
        <SettingsScreen
          key={session}
          saved={pattern}
          today={today}
          onSave={savePattern}
          onDirtyChange={handleDirtyChange}
          onResetPattern={pattern ? runResetPattern : undefined}
        />
      )}
      {view.kind === "settings-menu" && settings && pattern && (
        <SettingsMenu
          cycleLength={pattern.cycle.length}
          theme={settings.theme}
          weekStart={settings.weekStart}
          scheduleName={settings.scheduleName}
          onOpenNames={() => go({ kind: "names" })}
          onOpenPattern={() => go({ kind: "pattern" })}
          onOpenDisplay={() => {
            setDisplayError(null);
            go({ kind: "display" });
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
      {view.kind === "reset" && <ResetScreen key={session} onResetAll={runResetAll} />}
      {view.kind === "calendar" && settings && pattern && (
        <CalendarScreen
          pattern={pattern}
          weekStart={settings.weekStart}
          today={today}
          month={month}
          onMonthChange={setMonth}
          userName={settings.userName}
          scheduleName={settings.scheduleName}
          days={days}
          entriesNotice={entriesBroken ? ENTRIES_BROKEN_NOTICE : null}
          onSelectDate={toDay}
          onOpenSettings={toSettingsMenu}
        />
      )}
      {view.kind === "day" && pattern && (
        <DayScreen
          date={view.date}
          pattern={pattern}
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
