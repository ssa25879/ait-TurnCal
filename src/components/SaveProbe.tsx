// spike/save-location 전용: 실기기에서 saveBase64Data 저장 위치를 확인하는 임시 패널. main에 병합하지 않는다.
import { saveBase64Data, Share } from "@apps-in-toss/web-framework";
import { Button } from "@toss/tds-mobile";
import { useState } from "react";

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

const utf8Base64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

function probePng(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 300;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 300);
  ctx.fillStyle = "#4F46E5";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("턴캘 저장 테스트", 40, 120);
  ctx.fillStyle = "#333333";
  ctx.font = "28px sans-serif";
  ctx.fillText(new Date().toLocaleString("ko-KR"), 40, 190);
  return canvas.toDataURL("image/png").split(",")[1];
}

function probeIcs(): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TurnCal//KO",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:턴캘 저장 테스트",
    "BEGIN:VEVENT",
    "UID:turncal-probe-20261020@ait-turncal",
    "DTSTAMP:20261019T000000Z",
    "DTSTART;VALUE=DATE:20261020",
    "DTEND;VALUE=DATE:20261021",
    "SUMMARY:주간(테스트)",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:turncal-probe-20261021@ait-turncal",
    "DTSTAMP:20261019T000000Z",
    "DTSTART;VALUE=DATE:20261021",
    "DTEND;VALUE=DATE:20261022",
    "SUMMARY:야간(테스트)",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return utf8Base64(lines.join("\r\n") + "\r\n");
}

export function SaveProbe() {
  const [log, setLog] = useState<string[]>([]);
  const add = (line: string) => setLog((prev) => [`${stamp()} ${line}`, ...prev].slice(0, 8));

  const run = async (label: string, fileName: string, mimeType: string, data: () => string) => {
    try {
      if (!saveBase64Data.isSupported()) {
        add(`${label}: isSupported=false`);
        return;
      }
      await saveBase64Data({ data: data(), fileName, mimeType });
      add(`${label}: 성공 (${fileName})`);
    } catch (error) {
      add(`${label}: 실패 ${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`);
    }
  };

  const link = async () => {
    try {
      add(`링크: ${await Share.createLink({ path: "intoss://ait-turncal" })}`);
    } catch (error) {
      add(`링크 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="section" style={{ border: "2px dashed #c2410c", padding: 12, borderRadius: 12 }}>
      <h2 className="section-title">저장 위치 확인(테스트 번들 전용)</h2>
      <div style={{ display: "grid", gap: 8 }}>
        <Button size="medium" variant="weak" display="full" onClick={() => run("PNG", `turncal-probe-${stamp()}.png`, "image/png", probePng)}>
          1. PNG 이미지 저장
        </Button>
        <Button size="medium" variant="weak" display="full" onClick={() => run("ICS", `turncal-probe-${stamp()}.ics`, "text/calendar", probeIcs)}>
          2. 캘린더 파일(.ics) 저장
        </Button>
        <Button size="medium" variant="weak" display="full" onClick={() => run("TXT", `turncal-probe-${stamp()}.txt`, "text/plain", () => utf8Base64("턴캘 저장 테스트\n"))}>
          3. 텍스트 파일(.txt) 저장
        </Button>
        <Button size="medium" variant="weak" display="full" onClick={() => void link()}>
          4. 공유 링크 만들기
        </Button>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{log.join("\n") || "결과가 여기 표시돼요."}</pre>
    </section>
  );
}
