import { BottomSheet, ConfirmDialog } from "@toss/tds-mobile";
import type { ReminderSetting } from "../domain/calendarReminder";
import type { ExportKind } from "../export/exportMonth";
import { useCloseOnBack } from "../platform/overlayBack";

interface Props {
  open: boolean;
  busy: boolean;
  onClose(): void;
  onSelect(kind: ExportKind): void;
}

const OPTIONS: ReadonlyArray<{ kind: ExportKind; title: string; desc: string }> = [
  { kind: "image", title: "달력 이미지 보내기", desc: "이번 달 근무표를 사진 한 장으로 보내요." },
  {
    kind: "calendar",
    title: "캘린더 파일 보내기",
    desc: "공유 창에는 캘린더 앱이 없을 수 있어요.\n나와의 채팅, 드라이브 등으로 보낸 뒤 받은 파일을 열면 캘린더 앱에 추가할 수 있어요.",
  },
];

/** 이번 달 내보내기 선택지. 고르면 기기의 파일 공유 창이 열린다(취소해도 결과를 알 수 없다). */
export function ExportSheet({ open, busy, onClose, onSelect }: Props) {
  useCloseOnBack(open, onClose);
  return (
    <BottomSheet open={open} onClose={onClose} header={<BottomSheet.Header>이번 달 내보내기</BottomSheet.Header>}>
      <div className="export-sheet">
        <p className="section-desc">공유 창에서 카카오톡·드라이브 등 보낼 곳을 골라요. 근무만 담기고 세부 내용은 들어가지 않아요.</p>
        {OPTIONS.map((option) => (
          <button
            key={option.kind}
            type="button"
            className="export-option"
            disabled={busy}
            onClick={() => onSelect(option.kind)}
          >
            <span className="export-title">{option.title}</span>
            <span className="export-desc">{option.desc}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

interface ConfirmProps {
  open: boolean;
  reminder: ReminderSetting;
  onCancel(): void;
  onConfirm(): void;
}

interface ReviewProps {
  open: boolean;
  onLater(): void;
  onReview(): void;
}

/** 내보내기 뒤 리뷰 요청. 공유 창은 취소해도 결과가 같아 완료라고 말하지 않는다. */
export function ReviewRequestDialog({ open, onLater, onReview }: ReviewProps) {
  useCloseOnBack(open, onLater);
  return (
    <ConfirmDialog
      open={open}
      title="턴캘이 도움이 됐나요?"
      description="리뷰를 남겨 주시면 턴캘을 더 좋게 만드는 데 큰 힘이 돼요."
      onClose={onLater}
      cancelButton={<ConfirmDialog.CancelButton onClick={onLater}>다음에</ConfirmDialog.CancelButton>}
      confirmButton={<ConfirmDialog.ConfirmButton onClick={onReview}>리뷰 남기기</ConfirmDialog.ConfirmButton>}
    />
  );
}

/** 캘린더 파일을 보내기 전 알림·다시 가져오기 안내. 시트보다 큰 글자로 보여 준다. */
export function CalendarExportDialog({ open, reminder, onCancel, onConfirm }: ConfirmProps) {
  useCloseOnBack(open, onCancel);
  const reminderNote = reminder.enabled
    ? `근무 전날 ${reminder.hour}:00 알림을 파일에 넣어요. 비번·휴무는 제외해요.`
    : "턴캘 알림을 파일에 넣지 않아요. 설정에서 켤 수 있어요.";
  return (
    <ConfirmDialog
      open={open}
      title="캘린더 파일을 보낼까요?"
      description={
        <span className="export-confirm">
          <span className="export-reminder">{reminderNote}</span>
          <span className="export-default-reminder">캘린더 앱의 기본 알림이 따로 붙을 수 있어요.</span>
          <span className="export-reimport">
            이미 가져온 달은 그 달 일정을 지운 뒤 가져와야 바뀌어요. 저장된 캘린더는 가져온 뒤 확인해 주세요.
          </span>
        </span>
      }
      onClose={onCancel}
      cancelButton={<ConfirmDialog.CancelButton onClick={onCancel}>취소</ConfirmDialog.CancelButton>}
      confirmButton={<ConfirmDialog.ConfirmButton onClick={onConfirm}>보내기</ConfirmDialog.ConfirmButton>}
    />
  );
}
