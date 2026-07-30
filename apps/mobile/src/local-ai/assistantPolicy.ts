import {
  detectRestrictedHealthIntent,
  type AiAction
} from "@life-steward/life-core";

export type AssistantPolicyReasonCode =
  | "invalid_input"
  | "unsupported_action"
  | "restricted_health_intent"
  | "restricted_self_harm_or_violence"
  | "restricted_sexual_exploitation"
  | "restricted_fraud_or_deception"
  | "restricted_harassment"
  | "restricted_malicious_or_illegal";

export type AssistantPolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      reasonCode: AssistantPolicyReasonCode;
      message: string;
    };

export const ASSISTANT_RESTRICTED_MESSAGE =
  "이 앱의 AI는 건강, 약물, 증상, 진단, 치료 또는 응급상황에 관한 정보·권고·일정 생성과 유해하거나 불법적인 콘텐츠 생성을 제공하지 않습니다. 일반 일정·메모·체크리스트 정리는 도와드릴 수 있습니다.";

const MAX_ASSISTANT_INPUT_LENGTH = 6_000;
const MAX_ASSISTANT_OUTPUT_LENGTH = 12_000;
const SUPPORTED_ACTIONS = new Set<AiAction>([
  "summarize",
  "rewriteText",
  "suggestTitle",
  "draftChecklist"
]);

const RESTRICTED_PATTERNS: ReadonlyArray<{
  reasonCode: Exclude<
    AssistantPolicyReasonCode,
    "invalid_input" | "unsupported_action" | "restricted_health_intent"
  >;
  pattern: RegExp;
}> = [
  {
    reasonCode: "restricted_self_harm_or_violence",
    pattern:
      /(?:자살(?:방법|하는법|계획|유도)|자해(?:방법|하는법|도구|유도)|목숨(?:끊|버리)|죽고싶|폭탄(?:만드|만들|제조)|살인(?:방법|계획)|죽이는(?:법|방법)|무기(?:제작|만드|만들)|폭행(?:계획|방법)|suicide(?:method|instruction|plan)|selfharm(?:method|instruction|howto)|killmyself|howtomakeabomb|bomb(?:making|instruction|recipe)|murder(?:plan|instruction)|kill(?:someone|people)|weapon(?:making|instruction))/
  },
  {
    reasonCode: "restricted_sexual_exploitation",
    pattern:
      /(?:아동(?:성착취|성학대|음란)|미성년(?:성착취|음란|포르노)|강간(?:묘사|방법|장면)|성폭행(?:묘사|방법)|csam|childsexual(?:abuse|exploitation)|childporn|rape(?:scene|instruction))/
  },
  {
    reasonCode: "restricted_fraud_or_deception",
    pattern:
      /(?:사기(?:치는|치기|방법|수법)|피싱(?:메일|문자|사이트)(?:만들|작성|제작)|신분도용|보이스피싱(?:문구|대본|방법)|phishing(?:email|message|site)|identitytheft|credentialtheft|scam(?:email|message|script)|fraud(?:method|scheme|instruction))/
  },
  {
    reasonCode: "restricted_harassment",
    pattern:
      /(?:괴롭히는(?:법|방법|문구)|협박(?:문구|해서|하는법|메시지)|스토킹(?:방법|계획)|신상털기|doxx|harass(?:message|instruction)|blackmail(?:message|instruction)|stalk(?:someone|instruction))/
  },
  {
    reasonCode: "restricted_malicious_or_illegal",
    pattern:
      /(?:랜섬웨어|악성코드(?:작성|만들|제작)|해킹(?:방법|하는법)|마약(?:제조|만들)|불법약물(?:제조|만들)|위조(?:신분증|화폐)(?:만들|제작)|불법침입(?:방법|하는법)|ddos|credentialstealer|ransomware|malware(?:code|payload|write|create)|sqlinjection(?:payload|attack)|hack(?:account|instruction|password)|(?:make|manufacture)illegaldrugs?|illegaldrugs?(?:make|manufacture)|counterfeit(?:money|id)|breakinto(?:house|account))/
  }
];

const ACTION_INSTRUCTIONS: Readonly<Record<AiAction, string>> = {
  summarize:
    "핵심 사실만 3~5개의 짧은 문장으로 요약하세요. 새로운 사실이나 판단을 추가하지 마세요.",
  rewriteText:
    "뜻을 바꾸지 말고 읽기 쉬운 한국어 문장으로 다듬으세요. 설명이나 머리말을 덧붙이지 마세요.",
  suggestTitle:
    "내용을 대표하는 중립적인 한국어 제목 하나만 40자 이내로 제안하세요.",
  draftChecklist:
    "입력에 이미 있는 항목만 사용해 한 줄에 하나씩 '- '로 시작하는 체크리스트 초안을 만드세요."
};

export class AssistantPolicyError extends Error {
  constructor(
    readonly reasonCode: AssistantPolicyReasonCode,
    message = ASSISTANT_RESTRICTED_MESSAGE
  ) {
    super(message);
    this.name = "AssistantPolicyError";
  }
}

function compactForPolicy(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function guardText(text: string, maximumLength: number): AssistantPolicyDecision {
  if (
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > maximumLength
  ) {
    return {
      allowed: false,
      reasonCode: "invalid_input",
      message: "정리할 텍스트의 길이를 확인해 주세요."
    };
  }

  const healthDecision = detectRestrictedHealthIntent(text);
  if (!healthDecision.allowed) {
    return {
      allowed: false,
      reasonCode: "restricted_health_intent",
      message: ASSISTANT_RESTRICTED_MESSAGE
    };
  }

  const compact = compactForPolicy(text);
  for (const restricted of RESTRICTED_PATTERNS) {
    if (restricted.pattern.test(compact)) {
      return {
        allowed: false,
        reasonCode: restricted.reasonCode,
        message: ASSISTANT_RESTRICTED_MESSAGE
      };
    }
  }
  return { allowed: true };
}

export function guardAssistantInput(text: string): AssistantPolicyDecision {
  return guardText(text, MAX_ASSISTANT_INPUT_LENGTH);
}

export function guardAssistantOutput(text: string): AssistantPolicyDecision {
  return guardText(text, MAX_ASSISTANT_OUTPUT_LENGTH);
}

export function buildAssistantPrompt(action: AiAction, input: string): string {
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new AssistantPolicyError(
      "unsupported_action",
      "지원하는 문서 정리 동작을 선택해 주세요."
    );
  }
  const decision = guardAssistantInput(input);
  if (!decision.allowed) {
    throw new AssistantPolicyError(decision.reasonCode, decision.message);
  }

  return [
    "[SYSTEM]",
    "당신은 생활후견 AI의 기기 내 문서 정리 도구입니다.",
    "입력 텍스트 외의 사실을 추가하지 마세요.",
    "의료·건강 판단, 위해, 착취, 사기, 괴롭힘, 악성 코드 또는 불법행위를 생성하지 마세요.",
    "요청된 문서 정리 결과만 출력하세요.",
    `[ACTION:${action}]`,
    ACTION_INSTRUCTIONS[action],
    "[INPUT]",
    input.normalize("NFC"),
    "[OUTPUT]"
  ].join("\n");
}
