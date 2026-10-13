import { ConfirmDialog } from "@toss/tds-mobile";
import { useCallback, useEffect, useState } from "react";
import { CalendarScreen } from "./components/CalendarScreen";
import { LoadError } from "./components/LoadError";
import { SettingsScreen } from "./components/SettingsScreen";
import { SetupIntro } from "./components/SetupIntro";
import type { WeekStart, WorkPattern } from "./domain/types";
import {
  createOverlayRegistry,
  OverlayBackProvider,
  useCloseOnBack,
} from "./platform/overlayBack";
import { useBackHandler } from "./platform/useBackHandler";
import { useSafeArea } from "./platform/useSafeArea";
import { useToday } from "./platform/useToday";
import {
  loadSettings,
  saveSettings,
  type StoredSettingsV1,
} from "./storage/scheduleStorage";

type View =
  | { kind: "loading" }
  | { kind: "setup-intro" }
  | { kind: "load-error"; reason: string }
  | { kind: "settings" }
  | { kind: "calendar" };

export function App() {
  const [registry] = useState(createOverlayRegistry);
  return (
    <OverlayBackProvider registry={registry}>
      <TurnCal hasOpenOverlay={registry.hasOpen} closeTopOverlay={registry.closeTop} />
    </OverlayBackProvider>
  );
}

function TurnCal({
  hasOpenOverlay,
  closeTopOverlay,
}: {
  hasOpenOverlay: () => boolean;
  closeTopOverlay: () => void;
}) {
  useSafeArea();
  const today = useToday();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [settings, setSettings] = useState<StoredSettingsV1 | null>(null);
  const [dirty, setDirty] = useState(false);
  const [settingsSession, setSettingsSession] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [weekStartError, setWeekStartError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadSettings().then((result) => {
      if (!active) return;
      switch (result.kind) {
        case "ok":
          setSettings(result.settings);
          setView({ kind: "calendar" });
          break;
        case "empty":
          setView({ kind: "setup-intro" });
          break;
        case "corrupt":
          setView({ kind: "load-error", reason: result.reason });
          break;
        case "error":
          setView({
            kind: "load-error",
            reason: "기기 저장소를 읽지 못했어요. 앱을 다시 열어 주세요.",
          });
          break;
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const openSettings = () => {
    setDirty(false);
    setSettingsSession((n) => n + 1);
    setView({ kind: "settings" });
  };

  const backToCalendar = () => {
    setDirty(false);
    setDiscardOpen(false);
    setView({ kind: "calendar" });
  };

  useBackHandler(
    () => ({
      screen: view.kind,
      hasSavedSettings: settings !== null,
      isDirty: dirty,
      hasOverlay: hasOpenOverlay(),
    }),
    {
      closeOverlay: closeTopOverlay,
      toCalendar: backToCalendar,
      confirmDiscard: () => setDiscardOpen(true),
    },
  );

  const savePattern = async (pattern: WorkPattern) => {
    const next: StoredSettingsV1 = {
      version: 1,
      pattern,
      weekStart: settings?.weekStart ?? "SUN",
    };
    await saveSettings(next);
    setSettings(next);
    backToCalendar();
  };

  const changeWeekStart = async (weekStart: WeekStart) => {
    if (!settings || settings.weekStart === weekStart) return;
    const previous = settings;
    const next = { ...settings, weekStart };
    setSettings(next);
    setWeekStartError(null);
    try {
      await saveSettings(next);
    } catch {
      setSettings(previous);
      setWeekStartError("주 시작 요일을 저장하지 못했어요. 다시 시도해 주세요.");
    }
  };

  const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  return (
    <main className="app">
      {view.kind === "setup-intro" && <SetupIntro onStart={openSettings} />}
      {view.kind === "load-error" && <LoadError reason={view.reason} onReset={openSettings} />}
      {view.kind === "settings" && (
        <SettingsScreen
          key={settingsSession}
          saved={settings?.pattern ?? null}
          today={today}
          onSave={savePattern}
          onDirtyChange={handleDirtyChange}
        />
      )}
      {view.kind === "calendar" && settings && (
        <CalendarScreen
          pattern={settings.pattern}
          weekStart={settings.weekStart}
          today={today}
          weekStartError={weekStartError}
          onWeekStartChange={changeWeekStart}
          onOpenSettings={openSettings}
        />
      )}
      <DiscardDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={backToCalendar}
      />
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
      description="저장하지 않은 근무 패턴 변경은 사라져요."
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
