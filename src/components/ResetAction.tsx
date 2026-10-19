import { Button, ConfirmDialog } from "@toss/tds-mobile";
import { useState } from "react";
import { useCloseOnBack } from "../platform/overlayBack";

interface Props {
  title: string;
  /** 무엇이 지워지고 무엇이 남는지 */
  description: string;
  confirm: string;
  /** 확인 창의 실행 버튼 글자(기본 "초기화하기") */
  confirmLabel?: string;
  danger?: boolean;
  onReset(): Promise<void>;
}

/**
 * 초기화 버튼 하나와 확인 다이얼로그. 초기화는 확인한 뒤에만 실행되고 되돌릴 수 없다.
 * 실패하면 이 자리에서 안내한다(데이터·화면 상태 복원은 onReset 쪽 책임).
 */
export function ResetAction({ title, description, confirm, confirmLabel = "초기화하기", danger = false, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useCloseOnBack(open, () => setOpen(false));

  const run = async () => {
    setOpen(false);
    setBusy(true);
    setError(null);
    try {
      await onReset();
    } catch {
      setError("초기화하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section reset-option">
      <h2 className="section-title">{title}</h2>
      <p className="section-desc">{description}</p>
      <Button
        size="large"
        variant="weak"
        color={danger ? "danger" : "dark"}
        display="full"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {title}
      </Button>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={open}
        title={confirm}
        description={`${description} 되돌릴 수 없어요.`}
        onClose={() => setOpen(false)}
        cancelButton={<ConfirmDialog.CancelButton onClick={() => setOpen(false)}>취소</ConfirmDialog.CancelButton>}
        confirmButton={
          <ConfirmDialog.ConfirmButton color={danger ? "danger" : "primary"} onClick={() => void run()}>
            {confirmLabel}
          </ConfirmDialog.ConfirmButton>
        }
      />
    </section>
  );
}
