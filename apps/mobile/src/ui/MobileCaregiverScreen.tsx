import { useState } from "react";
import type { CareManual } from "@careguardian/care-core/manual";
import {
  caregiverSectionContent,
  updateMorningRoutine,
  updateMedicationName,
  updateMedicationTiming,
  updateRelayTargetContact,
  updateRelayTargetName
} from "@careguardian/care-core/manual";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { ScreenCard } from "./ScreenCard";
import {
  medicationConsentFingerprint,
  requiresMedicationConsent
} from "../security/privacyGate";

const PRIVACY_POLICY_URL = "https://sinmb79.github.io/careguardian-ai/privacy-policy.html";

interface MobileCaregiverScreenProps {
  manual: CareManual;
  isSaving: boolean;
  statusMessage: string;
  onChange: (manual: CareManual) => void;
  onSave: (manual: CareManual) => Promise<void>;
}

function cloneManual(manual: CareManual): CareManual {
  return JSON.parse(JSON.stringify(manual)) as CareManual;
}

function computeProgress(manual: CareManual): number {
  const fields = [
    manual.subject.name,
    manual.sections.daily_routine.morning[0]?.title,
    manual.sections.medication.drugs[0]?.name,
    manual.sections.communication.calming_methods[0],
    manual.relay_targets[0]?.name
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

export function MobileCaregiverScreen({
  manual,
  isSaving,
  statusMessage,
  onChange,
  onSave
}: MobileCaregiverScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [consentedMedicationFingerprint, setConsentedMedicationFingerprint] = useState<string | null>(null);
  const [consentError, setConsentError] = useState("");

  const patchManual = (update: (draft: CareManual) => void) => {
    const nextManual = cloneManual(manual);
    update(nextManual);
    onChange(nextManual);
  };

  const progress = computeProgress(manual);
  const medicationName = manual.sections.medication.drugs[0]?.name ?? "";
  const currentMedicationFingerprint = medicationConsentFingerprint(
    manual.sections.medication.drugs[0]
  );
  const hasMedicationConsent =
    currentMedicationFingerprint.length > 0 &&
    consentedMedicationFingerprint === currentMedicationFingerprint;
  const needsMedicationConsent = requiresMedicationConsent(medicationName, hasMedicationConsent);

  const save = async () => {
    if (needsMedicationConsent) {
      setConsentError("복약 정보를 저장하려면 아래의 별도 동의 확인이 필요합니다.");
      return;
    }
    setConsentError("");
    await onSave(manual);
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Caregiver Mode</Text>
        <Text style={styles.heading}>실제 돌봄이 이어지는 모바일 매뉴얼</Text>
        <Text style={styles.heroBody}>
          보호자가 남긴 습관, 약, 안정화 메모를 폰과 태블릿에서 바로 이어받을 수 있게 준비합니다.
        </Text>
      </View>

      {statusMessage ? (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      <View style={isTablet ? styles.cardsGrid : undefined}>
      <ScreenCard
        title={caregiverSectionContent[0].title}
        description={caregiverSectionContent[0].description}
        icon={caregiverSectionContent[0].icon}
        step={caregiverSectionContent[0].step}
        totalSteps={caregiverSectionContent[0].totalSteps}
        style={isTablet ? { flexBasis: "48%" } : undefined}
      >
        <LabeledInput
          label="피돌봄자 이름"
          value={manual.subject.name}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.subject.name = value;
            })
          }
          placeholder="예: 수호"
        />
        <LabeledInput
          label="아침 루틴"
          value={manual.sections.daily_routine.morning[0]?.title ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.daily_routine.morning = updateMorningRoutine(
                draft.sections.daily_routine.morning[0],
                value
              );
            })
          }
          placeholder="예: 아침 식사"
        />
        <LabeledInput
          label="긴급 연락처"
          value={manual.subject.emergency_contacts[0] ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.subject.emergency_contacts = value ? [value] : [];
            })
          }
          placeholder="예: 이모 010-0000-0000"
        />
      </ScreenCard>

      <ScreenCard
        title={caregiverSectionContent[1].title}
        description={caregiverSectionContent[1].description}
        icon={caregiverSectionContent[1].icon}
        step={caregiverSectionContent[1].step}
        totalSteps={caregiverSectionContent[1].totalSteps}
        style={isTablet ? { flexBasis: "48%" } : undefined}
      >
        <LabeledInput
          label="복약 이름"
          value={manual.sections.medication.drugs[0]?.name ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.medication.drugs = updateMedicationName(
                draft.sections.medication.drugs[0],
                value
              );
            })
          }
          placeholder="예: 빨간 알약"
        />
        <LabeledInput
          label="복약 시각"
          value={manual.sections.medication.drugs[0]?.timing ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.medication.drugs = updateMedicationTiming(
                draft.sections.medication.drugs[0],
                value
              );
            })
          }
          placeholder="예: 08:30"
        />
      </ScreenCard>

      <ScreenCard
        title={caregiverSectionContent[2].title}
        description={caregiverSectionContent[2].description}
        icon={caregiverSectionContent[2].icon}
        step={caregiverSectionContent[2].step}
        totalSteps={caregiverSectionContent[2].totalSteps}
        style={isTablet ? { flexBasis: "48%" } : undefined}
      >
        <LabeledInput
          label="안정화 방법"
          value={manual.sections.communication.calming_methods[0] ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.communication.calming_methods = value ? [value] : [];
            })
          }
          placeholder="예: 조용한 목소리"
        />
        <LabeledInput
          label="안전 공간"
          value={manual.sections.emotional.safe_spaces[0] ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.emotional.safe_spaces = value ? [value] : [];
            })
          }
          placeholder="예: 거실 소파"
        />
      </ScreenCard>

      <ScreenCard
        title={caregiverSectionContent[3].title}
        description={caregiverSectionContent[3].description}
        icon={caregiverSectionContent[3].icon}
        step={caregiverSectionContent[3].step}
        totalSteps={caregiverSectionContent[3].totalSteps}
        style={isTablet ? { flexBasis: "48%" } : undefined}
      >
        <LabeledInput
          label="1차 릴레이 대상"
          value={manual.relay_targets[0]?.name ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.relay_targets = updateRelayTargetName(draft.relay_targets[0], value);
            })
          }
          placeholder="예: 이모"
        />
        <LabeledInput
          label="릴레이 연락처"
          value={manual.relay_targets[0]?.contact ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.relay_targets = updateRelayTargetContact(draft.relay_targets[0], value);
            })
          }
          placeholder="예: 010-0000-0000"
        />
      </ScreenCard>
      </View>

      {medicationName.trim() ? (
        <View style={styles.consentBox} accessibilityLabel="복약 정보 별도 동의">
          <Text style={styles.consentTitle}>복약 정보 저장 전 확인</Text>
          <Text style={styles.consentBody}>
            테스트 목적으로 민감한 복약 정보를 이 기기에 저장하는 데 동의합니다. 이 앱은 진단·처방·복약 지시를 대신하지 않으며, 알림은 권한과 기기 상태에 따라 누락될 수 있습니다.
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="복약 정보 저장 동의"
            accessibilityState={{ checked: hasMedicationConsent }}
            style={styles.checkboxRow}
            onPress={() => {
              setConsentedMedicationFingerprint((current) =>
                current === currentMedicationFingerprint ? null : currentMedicationFingerprint
              );
              setConsentError("");
            }}
          >
            <View style={[styles.checkbox, hasMedicationConsent && styles.checkboxChecked]}>
              <Text style={styles.checkboxMark}>{hasMedicationConsent ? "✓" : ""}</Text>
            </View>
            <Text style={styles.checkboxLabel}>위 내용을 이해했고 복약 정보 저장에 동의합니다.</Text>
          </Pressable>
          {consentError ? <Text style={styles.consentError}>{consentError}</Text> : null}
        </View>
      ) : null}

      <View style={styles.privacyNotice}>
        <Text style={styles.privacyNoticeText}>연락처·건강·복약 정보는 민감할 수 있습니다. 개인정보처리방침에서 보관과 삭제 방법을 확인해 주세요.</Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="개인정보처리방침 열기"
          onPress={() =>
            void Linking.openURL(PRIVACY_POLICY_URL).catch(() =>
              Alert.alert("링크를 열 수 없습니다", "인터넷 연결을 확인한 뒤 다시 시도해 주세요.")
            )
          }
        >
          <Text style={styles.privacyLink}>개인정보처리방침 보기</Text>
        </Pressable>
      </View>

      <View style={styles.progressBox}>
        <Text style={styles.progressLabel}>
          {progress === 100 ? "\u2705 \uB9E4\uB274\uC5BC \uC791\uC131 \uC644\uB8CC!" : `\u270F\uFE0F \uB9E4\uB274\uC5BC \uC791\uC131 \uC9C4\uD589\uB960 ${progress}%`}
        </Text>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSaving ? "저장 중" : "저장하고 동반자 화면 열기"}
        style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
        disabled={isSaving}
        onPress={() => void save()}
      >
        <Text style={styles.primaryButtonLabel}>
          {isSaving ? "저장 중..." : "저장하고 동반자 화면 열기"}
        </Text>
      </Pressable>
    </View>
  );
}

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onChangeValue?: () => void;
  placeholder: string;
}

function LabeledInput({ label, value, onChangeText, onChangeValue, placeholder }: LabeledInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={(nextValue) => {
          onChangeText(nextValue);
          onChangeValue?.();
        }}
        placeholder={placeholder}
        placeholderTextColor="#9aa7ab"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "space-between"
  },
  hero: {
    borderRadius: 32,
    backgroundColor: "#183138",
    padding: 22,
    gap: 10
  },
  kicker: {
    color: "#cde0d7",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  heading: {
    color: "#fffdf7",
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 38
  },
  heroBody: {
    color: "#d8e4df",
    fontSize: 17,
    lineHeight: 26
  },
  statusBanner: {
    backgroundColor: "#e8f0e9",
    borderRadius: 16,
    padding: 14,
    alignItems: "center"
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#3a4e54",
    textAlign: "center"
  },
  field: {
    gap: 10
  },
  label: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a2626"
  },
  input: {
    borderWidth: 2,
    borderColor: "#d9dfdf",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#f7f2e8",
    color: "#1a2626",
    fontSize: 18,
    minHeight: 52
  },
  progressBox: {
    backgroundColor: "rgba(111, 138, 112, 0.1)",
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    gap: 10
  },
  consentBox: {
    gap: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: "#c4684f",
    borderRadius: 20,
    backgroundColor: "#fff5ed"
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#5c2c24"
  },
  consentBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#523c37"
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: "#5c2c24",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxChecked: {
    backgroundColor: "#5c2c24"
  },
  checkboxMark: {
    color: "#fffdf7",
    fontSize: 20,
    fontWeight: "800"
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    color: "#3d2d29",
    fontWeight: "700"
  },
  consentError: {
    fontSize: 15,
    lineHeight: 22,
    color: "#9c3d32",
    fontWeight: "700"
  },
  privacyNotice: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#e8f0e9"
  },
  privacyNoticeText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#3a4e54"
  },
  privacyLink: {
    fontSize: 16,
    color: "#183138",
    fontWeight: "800",
    textDecorationLine: "underline"
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6f8a70"
  },
  progressBarBg: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(31, 42, 42, 0.06)"
  },
  progressBarFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6f8a70"
  },
  primaryButton: {
    backgroundColor: "#c4684f",
    paddingVertical: 22,
    borderRadius: 999,
    alignItems: "center",
    minHeight: 56
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonLabel: {
    color: "#fffdf7",
    fontSize: 18,
    fontWeight: "700"
  }
});
