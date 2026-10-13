import { ConfirmDialog } from "@toss/tds-mobile";
import { useCallback, useEffect, useState } from "react";
import { CalendarScreen } from "./components/CalendarScreen";
import { DisplaySettingsScreen } from "./components/DisplaySettingsScreen";
import { LoadError } from "./components/LoadError";
import { SettingsMenu } from "./components/SettingsMenu";
import { SettingsScreen } from "./components/SettingsScreen";
import { SetupIntro } from "./components/SetupIntro";
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
import {
  loadSettings,
  saveSettings,
  type StoredSettingsV2,
} from "./storage/scheduleStorage";

type View =
  | { kind: "loading" }
  | { kind: "setup-intro" }
  | { kind: "load-error"; reason: string }
  | { kind: "calendar" }
  | { kind: "settings-menu" }
  | { kind: "pattern" }
  | { kind: "display" };

type DisplayPatch = Partial<Pick<StoredSettingsV2, "theme" | "weekStart">>;

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
  const today = useToday();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [settings, setSettings] = useState<StoredSettingsV2 | null>(null);
  const [dirty, setDirty] = useState(false);
  const [patternSession, setPatternSession] = useState(0);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);

  useEffect(() => {
    onThemeChange(settings?.theme ?? DEFAULT_THEME);
  }, [settings?.theme, onThemeChange]);

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

  const openPattern = () => {
    setDirty(false);
    setPatternSession((n) => n + 1);
    setView({ kind: "pattern" });
  };

  const openSettingsMenu = () => {
    setDirty(false);
    setDiscardOpen(false);
    setView({ kind: "settings-menu" });
  };

  const openDisplay = () => {
    setDisplayError(null);
    setView({ kind: "display" });
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
      toSettingsMenu: openSettingsMenu,
      confirmDiscard: () => setDiscardOpen(true),
    },
  );

  const savePattern = async (pattern: WorkPattern) => {
    const next: StoredSettingsV2 = {
      version: 2,
      pattern,
      weekStart: settings?.weekStart ?? "SUN",
      theme: settings?.theme ?? DEFAULT_THEME,
    };
    await saveSettings(next);
    setSettings(next);
    backToCalendar();
  };

  /** 테마·주 시작 요일 공통: 낙관적으로 반영하고, 저장에 실패하면 이전 값으로 되돌린다. */
  const updateDisplaySettings = async (patch: DisplayPatch) => {
    if (!settings) return;
    const previous = settings;
    const next: StoredSettingsV2 = { ...settings, ...patch, version: 2 };
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

  const handleDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  return (
    <main className="app">
      {view.kind === "setup-intro" && <SetupIntro onStart={openPattern} />}
      {view.kind === "load-error" && <LoadError reason={view.reason} onReset={openPattern} />}
      {view.kind === "pattern" && (
        <SettingsScreen
          key={patternSession}
          saved={settings?.pattern ?? null}
          today={today}
          onSave={savePattern}
          onDirtyChange={handleDirtyChange}
        />
      )}
      {view.kind === "settings-menu" && settings && (
        <SettingsMenu
          cycleLength={settings.pattern.cycle.length}
          theme={settings.theme}
          weekStart={settings.weekStart}
          onOpenPattern={openPattern}
          onOpenDisplay={openDisplay}
        />
      )}
      {view.kind === "display" && settings && (
        <DisplaySettingsScreen
          theme={settings.theme}
          weekStart={settings.weekStart}
          error={displayError}
          onThemeChange={(theme) => void updateDisplaySettings({ theme })}
          onWeekStartChange={(weekStart) => void updateDisplaySettings({ weekStart })}
        />
      )}
      {view.kind === "calendar" && settings && (
        <CalendarScreen
          pattern={settings.pattern}
          weekStart={settings.weekStart}
          today={today}
          onOpenSettings={openSettingsMenu}
        />
      )}
      <DiscardDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={openSettingsMenu}
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
