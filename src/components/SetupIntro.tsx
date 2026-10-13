import { Button } from "@toss/tds-mobile";

/** 저장된 설정이 없을 때의 첫 화면. 바텀시트가 아닌 일반 화면으로 안내한다. */
export function SetupIntro({ onStart }: { onStart: () => void }) {
  return (
    <section className="intro">
      <h1 className="intro-title">
        근무 순서만 등록하면
        <br />
        교대근무 달력이 완성돼요
      </h1>
      <p className="intro-desc">
        주간·야간·비번·휴무처럼 반복되는 순서와 오늘이 몇 번째인지만 알려 주세요. 지난 날과
        앞으로의 근무를 자동으로 계산해 보여 드려요.
      </p>
      <div className="intro-example" aria-hidden="true">
        <span className="chip shift-DAY">주</span>
        <span className="chip shift-DAY">주</span>
        <span className="chip shift-NIGHT">야</span>
        <span className="chip shift-NIGHT">야</span>
        <span className="chip shift-OFF">휴</span>
        <span className="chip shift-OFF">휴</span>
      </div>
      <div className="bottom-action">
        <Button size="xlarge" display="full" onClick={onStart}>
          패턴 등록하기
        </Button>
      </div>
    </section>
  );
}
