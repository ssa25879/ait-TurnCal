import { Button, ConfirmDialog } from "@toss/tds-mobile";
import { useState } from "react";
import { useCloseOnBack } from "../platform/overlayBack";

type ResetKind = "pattern" | "display" | "all";

const OPTIONS: Record<ResetKind, { title: string; description: string; confirm: string; danger: boolean }> = {
  pattern: {
    title: "근무 패턴 초기화",
    description: "반복 근무 순서와 기준일을 지우고 다시 등록해요. 화면 설정·이름·날짜 세부 내용은 남아요.",
    confirm: "근무 패턴을 초기화할까요?",
    danger: false,
  },
  display: {
    title: "화면 설정 초기화",
    description: "테마를 인디고, 주 시작 요일을 일요일로 되돌려요. 다른 데이터는 그대로예요.",
    confirm: "화면 설정을 초기화할까요?",
    danger: false,
  },
  all: {
    title: "전체 초기화",
    description: "근무 패턴, 화면 설정, 이름, 날짜 세부 내용을 모두 지우고 처음 상태로 돌아가요.",
    confirm: "모든 데이터를 지울까요?",
    danger: true,
  },
};

interface Props {
  onReset(kind: ResetKind): Promise<void>;
}

/** 초기화는 무엇이 지워지는지 확인한 뒤에만 실행된다. 되돌릴 수 없다. */
export function ResetScreen({ onReset }: Props) {
  const [pending, setPending] = useState<ResetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useCloseOnBack(pending !== null, () => setPending(null));

  const run = async (kind: ResetKind) => {
    setPending(null);
    setBusy(true);
    setError(null);
    try {
      await onReset(kind);
    } catch {
      setError("초기화하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="reset-screen">
      <h1 className="page-title">초기화</h1>
      <p className="section-desc">초기화한 데이터는 되돌릴 수 없어요.</p>

      {(Object.keys(OPTIONS) as ResetKind[]).map((kind) => (
        <section key={kind} className="section reset-option">
          <h2 className="section-title">{OPTIONS[kind].title}</h2>
          <p className="section-desc">{OPTIONS[kind].description}</p>
          <Button
            size="large"
            variant="weak"
            color={OPTIONS[kind].danger ? "danger" : "dark"}
            display="full"
            disabled={busy}
            onClick={() => setPending(kind)}
          >
            {OPTIONS[kind].title}
          </Button>
        </section>
      ))}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending ? OPTIONS[pending].confirm : ""}
        description={pending ? `${OPTIONS[pending].description} 되돌릴 수 없어요.` : ""}
        onClose={() => setPending(null)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setPending(null)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={
          <ConfirmDialog.ConfirmButton
            color={pending && OPTIONS[pending].danger ? "danger" : "primary"}
            onClick={() => pending && void run(pending)}
          >
            초기화하기
          </ConfirmDialog.ConfirmButton>
        }
      />
    </section>
  );
}

export type { ResetKind };
