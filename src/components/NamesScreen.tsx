import { Button, TextField } from "@toss/tds-mobile";
import { useEffect, useState } from "react";
import { normalizeName, SCHEDULE_NAME_MAX, scheduleTitle, USER_NAME_MAX } from "../domain/names";

interface Props {
  userName: string | null;
  scheduleName: string | null;
  onSave(names: { userName: string | null; scheduleName: string | null }): Promise<void>;
  onDirtyChange(dirty: boolean): void;
}

const lengthOf = (value: string) => Array.from(value.trim()).length;

/** 사용자 호칭과 근무표 이름. 둘 다 선택 입력이며 [저장]을 눌렀을 때만 반영된다. */
export function NamesScreen({ userName, scheduleName, onSave, onDirtyChange }: Props) {
  const [user, setUser] = useState(userName ?? "");
  const [schedule, setSchedule] = useState(scheduleName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextUser = normalizeName(user);
  const nextSchedule = normalizeName(schedule);
  const dirty = nextUser !== userName || nextSchedule !== scheduleName;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const userTooLong = lengthOf(user) > USER_NAME_MAX;
  const scheduleTooLong = lengthOf(schedule) > SCHEDULE_NAME_MAX;
  const canSave = !userTooLong && !scheduleTooLong;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ userName: nextUser, scheduleName: nextSchedule });
    } catch {
      setError("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  };

  return (
    <section className="names-screen">
      <h1 className="page-title">이름</h1>
      <p className="section-desc">달력 위에 보여 줄 이름이에요. 비워 두면 "내 근무표"로 보여요.</p>

      <div className="form-field">
        <TextField
          variant="box"
          label="근무표 이름"
          labelOption="sustain"
          aria-label="근무표 이름"
          placeholder="예: 병동 3교대"
          value={schedule}
          hasError={scheduleTooLong}
          help={scheduleTooLong ? `${SCHEDULE_NAME_MAX}자까지 쓸 수 있어요.` : `${lengthOf(schedule)}/${SCHEDULE_NAME_MAX}`}
          onChange={(event) => setSchedule(event.target.value)}
        />
      </div>
      <div className="form-field">
        <TextField
          variant="box"
          label="내 호칭"
          labelOption="sustain"
          aria-label="내 호칭"
          placeholder="예: 지수"
          value={user}
          hasError={userTooLong}
          help={userTooLong ? `${USER_NAME_MAX}자까지 쓸 수 있어요.` : `${lengthOf(user)}/${USER_NAME_MAX}`}
          onChange={(event) => setUser(event.target.value)}
        />
      </div>

      <div className="name-preview" aria-label="미리보기">
        <p className="schedule-title">{scheduleTitle(nextSchedule)}</p>
        {nextUser && <p className="schedule-owner">{nextUser}님</p>}
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="bottom-action">
        <Button size="xlarge" display="full" disabled={!canSave} loading={saving} onClick={save}>
          저장
        </Button>
      </div>
    </section>
  );
}
