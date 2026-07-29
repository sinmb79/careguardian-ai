export type PolicyDecision = {
  allowed: boolean;
  reasonCode?: "restricted_health_intent";
  message?: string;
};

const RESTRICTED_HEALTH_PATTERN = /(약|투약|처방|진단|증상|치료|복약|병원|의사|의료|medication|medicine|prescription|diagnos(?:e|is)|symptom|treatment|dosage|dose|doctor|hospital|medical|healthcare)/i;

export function detectRestrictedHealthIntent(input: string): PolicyDecision {
  const normalized = input.normalize("NFKC").replace(/[\s\p{P}\p{S}_]+/gu, "").toLowerCase();
  if (RESTRICTED_HEALTH_PATTERN.test(normalized)) {
    return {
      allowed: false,
      reasonCode: "restricted_health_intent",
      message: "의료·건강 관련 요청은 이 생활 관리 기능에서 처리할 수 없습니다.",
    };
  }
  return { allowed: true };
}
