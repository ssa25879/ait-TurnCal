import { Button } from "@toss/tds-mobile";

/** 저장된 설정을 읽지 못했을 때. 저장값은 사용자가 새 설정을 저장하기 전까지 그대로 둔다. */
export function LoadError({ reason, onReset }: { reason: string; onReset: () => void }) {
  return (
    <section className="intro">
      <h1 className="intro-title">저장된 근무 설정을 불러오지 못했어요</h1>
      <p className="intro-desc">{reason}</p>
      <p className="intro-desc">
        기존 데이터는 지우지 않았어요. 다시 설정하고 저장하면 새 설정으로 바뀌어요.
      </p>
      <div className="bottom-action">
        <Button size="xlarge" display="full" onClick={onReset}>
          다시 설정하기
        </Button>
      </div>
    </section>
  );
}
