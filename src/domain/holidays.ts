import { weekdayOf } from "./calendar";
import { addDays } from "./date";

/**
 * 대한민국 관공서 공휴일(표시 전용 — 근무 계산에는 쓰지 않는다).
 *
 * 근거
 * - 「관공서의 공휴일에 관한 규정」 대통령령 제36290호(2026-04-30 공포, 2026-05-01 시행)
 *   제2조(공휴일)·제3조(대체공휴일). 이 개정으로 노동절·제헌절이 공휴일이 됐다.
 *   지원 범위의 첫 노동절(2026-05-01)·제헌절(2026-07-17)은 모두 시행일 이후다.
 * - 음력 공휴일 양력 날짜: 한국천문연구원 음양력 변환(astro.kasi.re.kr/life/lunc/between, 2026-10-13 조회).
 * - 선거일(제2조제10호의2): 「공직선거법」 제34조로 계산. 2028년 이후는 선관위 공고 전 계산값이다.
 * - 대조: 우주항공청 「2027년 월력요항」(2026-06-29) 대체공휴일 7일·공휴일 72일 — holidays.test.ts.
 *
 * 갱신 방법: 새 연도는 천문연 값을 LUNAR에 더하고, 선거일·임시공휴일을 표에 넣은 뒤
 * 그해 월력요항 발표 내용을 테스트로 고정한다. 규정이 바뀌면 제2조·제3조 구현부터 고친다.
 */

export interface Holiday {
  /** 날짜 화면·접근성 이름에 쓰는 전체 이름 */
  name: string;
  /** 달력 칸에 쓰는 축약 이름(최대 3자) */
  short: string;
}

export const HOLIDAY_FIRST_YEAR = 2026;
export const HOLIDAY_LAST_YEAR = 2035;

/** [설날(음력 1월 1일), 부처님 오신 날(음력 4월 8일), 추석(음력 8월 15일)] 양력 날짜 */
const LUNAR: Record<number, [string, string, string]> = {
  2026: ["2026-02-17", "2026-05-24", "2026-09-25"],
  2027: ["2027-02-07", "2027-05-13", "2027-09-15"],
  2028: ["2028-01-27", "2028-05-02", "2028-10-03"],
  2029: ["2029-02-13", "2029-05-20", "2029-09-22"],
  2030: ["2030-02-03", "2030-05-09", "2030-09-12"],
  2031: ["2031-01-23", "2031-05-28", "2031-10-01"],
  2032: ["2032-02-11", "2032-05-16", "2032-09-19"],
  2033: ["2033-01-31", "2033-05-06", "2033-09-08"],
  2034: ["2034-02-19", "2034-05-25", "2034-09-27"],
  2035: ["2035-02-08", "2035-05-15", "2035-09-16"],
};

/** 임기만료에 의한 선거의 선거일(공직선거법 제34조) */
const ELECTIONS: Record<string, string> = {
  "2026-06-03": "지방선거일", // 확정
  "2028-04-12": "국회의원선거일", // 22대 임기만료 2028-05-29
  "2030-03-27": "대통령선거일", // 21대 임기만료 2030-06-03
  "2030-06-12": "지방선거일", // 06-05의 다음 날이 현충일이라 다음 주 수요일
  "2032-04-14": "국회의원선거일",
  "2034-05-31": "지방선거일",
};

/** 정부가 수시 지정한 임시공휴일(제2조제11호). 발표되면 추가한다. */
const TEMPORARY: Record<string, string> = {};

/**
 * 대체공휴일 대상 구분(제3조제1항).
 * - weekend: 토·일과 겹치면 대체(국경일, 부처님 오신 날, 노동절, 어린이날, 기독탄신일)
 * - sunday: 일요일과 겹치면 대체(설·추석 연휴)
 * - none: 대체 없음(1월 1일, 현충일, 선거일, 임시공휴일)
 * weekend·sunday는 평일에 다른 공휴일과 겹쳐도 대체한다.
 */
type SubstituteRule = "weekend" | "sunday" | "none";

interface BaseHoliday extends Holiday {
  date: string;
  rule: SubstituteRule;
}

function threeDays(center: string, names: [string, string, string], short: string): BaseHoliday[] {
  return [-1, 0, 1].map((offset, i) => ({
    date: addDays(center, offset),
    name: names[i],
    short,
    rule: "sunday" as const,
  }));
}

/** 제2조 공휴일(일요일 제외). 지원 범위 밖 연도는 빈 배열이다. */
export function baseHolidays(year: number): BaseHoliday[] {
  const lunar = LUNAR[year];
  if (!lunar) return [];
  const [seollal, buddha, chuseok] = lunar;
  const fixed = (md: string, name: string, short: string, rule: SubstituteRule): BaseHoliday => ({
    date: `${year}-${md}`,
    name,
    short,
    rule,
  });
  const pick = (table: Record<string, string>, short: string): BaseHoliday[] =>
    Object.entries(table)
      .filter(([date]) => date.startsWith(`${year}-`))
      .map(([date, name]) => ({ date, name, short, rule: "none" as const }));

  return [
    fixed("01-01", "신정", "신정", "none"),
    ...threeDays(seollal, ["설날 전날", "설날", "설날 다음 날"], "설날"),
    fixed("03-01", "삼일절", "삼일절", "weekend"),
    fixed("05-01", "노동절", "노동절", "weekend"),
    fixed("05-05", "어린이날", "어린이", "weekend"),
    { date: buddha, name: "부처님 오신 날", short: "부처님", rule: "weekend" },
    fixed("06-06", "현충일", "현충일", "none"),
    fixed("07-17", "제헌절", "제헌절", "weekend"),
    fixed("08-15", "광복절", "광복절", "weekend"),
    ...threeDays(chuseok, ["추석 전날", "추석", "추석 다음 날"], "추석"),
    fixed("10-03", "개천절", "개천절", "weekend"),
    fixed("10-09", "한글날", "한글날", "weekend"),
    fixed("12-25", "기독탄신일", "성탄절", "weekend"),
    ...pick(ELECTIONS, "선거일"),
    ...pick(TEMPORARY, "임시"),
  ];
}

/**
 * 제2조 공휴일 목록에 제3조 대체공휴일을 더한다.
 * 날짜별로 잃은 공휴일 수를 세고(주말: 대체 대상 수, 평일: 공휴일 수 - 1과 대체 대상 수 중 작은 값),
 * 날짜순으로 그 날 다음의 첫 비공휴일(토·일·공휴일·이미 정한 대체공휴일이 아닌 날)을 대체공휴일로 정한다.
 */
export function withSubstitutes(base: BaseHoliday[]): Map<string, Holiday[]> {
  const byDate = new Map<string, BaseHoliday[]>();
  for (const holiday of base) {
    byDate.set(holiday.date, [...(byDate.get(holiday.date) ?? []), holiday]);
  }
  const result = new Map<string, Holiday[]>();
  for (const [date, list] of byDate) result.set(date, list.map(({ name, short }) => ({ name, short })));

  const isOff = (date: string) => {
    const day = weekdayOf(date);
    return day === 0 || day === 6 || result.has(date);
  };

  for (const date of [...byDate.keys()].sort()) {
    const list = byDate.get(date)!;
    const day = weekdayOf(date);
    const qualifying =
      day === 0
        ? list.filter((h) => h.rule !== "none")
        : day === 6
          ? list.filter((h) => h.rule === "weekend")
          : list.length > 1
            ? list.filter((h) => h.rule !== "none").slice(0, list.length - 1)
            : [];
    let cursor = date;
    for (const holiday of qualifying) {
      do cursor = addDays(cursor, 1);
      while (isOff(cursor));
      const origin = holiday.rule === "sunday" ? holiday.short : holiday.name;
      result.set(cursor, [{ name: `${origin} 대체공휴일`, short: "대체" }]);
    }
  }
  return result;
}

const cache = new Map<number, Map<string, Holiday[]>>();

/** 그 날짜의 공휴일 목록(일요일 자체는 포함하지 않는다). 지원 범위 밖이면 빈 배열이다. */
export function getHolidays(date: string): Holiday[] {
  const year = Number(date.slice(0, 4));
  if (year < HOLIDAY_FIRST_YEAR || year > HOLIDAY_LAST_YEAR) return [];
  let table = cache.get(year);
  if (!table) {
    table = withSubstitutes(baseHolidays(year));
    cache.set(year, table);
  }
  return table.get(date) ?? [];
}
