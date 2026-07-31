export type PolicyDecision = {
  allowed: boolean;
  reasonCode?: "restricted_health_intent";
  message?: string;
};

const RESTRICTED_HEALTH_PATTERN = /(?:복약|투약|약먹|약을|약물|약품|처방약|처방|진단|증상|치료|알레르기|질환|재활|건강|혈압|혈당|체온|심박|맥박|bmi|병원|의사|의료|medication|medicine|prescription|diagnos(?:e|is)|symptom|treatment|dosage|dose|allerg(?:y|ies|ic)|disease|rehabilitation|health|bloodpressure|bloodsugar|bodytemperature|heartrate|pulse|bmi|doctor|hospital|medical|healthcare)/i;

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
