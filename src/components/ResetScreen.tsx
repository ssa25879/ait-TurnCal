import { ResetAction } from "./ResetAction";

interface Props {
  onResetAll(): Promise<void>;
}

/** 전체 초기화. 근무 패턴·화면 설정 초기화는 각 설정 화면 아래에 있다. */
export function ResetScreen({ onResetAll }: Props) {
  return (
    <section className="reset-screen">
      <h1 className="page-title">초기화</h1>
      <p className="section-desc">초기화한 데이터는 되돌릴 수 없어요.</p>
      <ResetAction
        title="전체 초기화"
        description="근무 패턴, 화면 설정, 이름, 날짜 세부 내용을 모두 지우고 처음 상태로 돌아가요."
        confirm="모든 데이터를 지울까요?"
        danger
        onReset={onResetAll}
      />
    </section>
  );
}
