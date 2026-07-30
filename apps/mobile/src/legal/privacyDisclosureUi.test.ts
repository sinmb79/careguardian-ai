import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("privacy disclosure UI contract", () => {
  test("shows the offline privacy boundary and the fixed privacy-policy action in settings", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/mobile/src/ui/LifeWorkspaceScreen.tsx"),
      "utf8"
    );

    expect(source).toContain("개인정보처리방침");
    expect(source).toContain("로그인·광고·분석 SDK·클라우드 AI를 사용하지 않습니다.");
    expect(source).toContain("작업·목록·사용자 기능·프롬프트·결과는 이 기기에 저장됩니다.");
    expect(source).toContain("모델 설치를 사용자가 선택한 경우에만 Hugging Face에 네트워크 요청이 발생합니다.");
    expect(source).toContain("개인정보처리방침 열기");
  });

  test("shows the complete Hugging Face installation disclosure before consent", () => {
    const source = readFileSync(
      resolve(process.cwd(), "apps/mobile/src/ui/LocalAiScreen.tsx"),
      "utf8"
    );

    for (const requiredText of [
      "수신자: Hugging Face",
      "IP 주소, IP 기반 대략적 위치, 기기·운영체제·브라우저/네트워크 정보",
      "선택한 모델 요청 경로와 서비스 이용 기록",
      "파일 제공, 서비스 운영·개선·분석, 보안 및 법적 의무",
      "미국 등 다른 국가에서 처리될 수 있고 필요한 기간 보존",
      "privacy@huggingface.co",
      "프롬프트·AI 결과·생활 작업 내용은 Hugging Face에 보내지지 않습니다.",
      "설치는 선택 사항이며 거부해도 일반 생활 기능은 사용 가능",
      "Hugging Face 개인정보처리방침 열기"
    ]) {
      expect(source).toContain(requiredText);
    }
  });
});
