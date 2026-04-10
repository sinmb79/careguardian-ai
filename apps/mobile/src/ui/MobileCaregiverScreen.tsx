import type { CareManual } from "@careguardian/care-core/manual";
import { caregiverSectionContent } from "@careguardian/care-core/manual";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenCard } from "./ScreenCard";

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

export function MobileCaregiverScreen({
  manual,
  isSaving,
  statusMessage,
  onChange,
  onSave
}: MobileCaregiverScreenProps) {
  const patchManual = (update: (draft: CareManual) => void) => {
    const nextManual = cloneManual(manual);
    update(nextManual);
    onChange(nextManual);
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

      <Text style={styles.status}>{statusMessage}</Text>

      <ScreenCard
        title={caregiverSectionContent[0].title}
        description={caregiverSectionContent[0].description}
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
              draft.sections.daily_routine.morning = value
                ? [
                    {
                      title: value,
                      notes: `${value} 전에 차분히 준비한다.`
                    }
                  ]
                : [];
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
      >
        <LabeledInput
          label="복약 이름"
          value={manual.sections.medication.drugs[0]?.name ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.sections.medication.drugs = value
                ? [
                    {
                      name: value,
                      dosage: draft.sections.medication.drugs[0]?.dosage || "1정",
                      timing: draft.sections.medication.drugs[0]?.timing || "08:30",
                      method: draft.sections.medication.drugs[0]?.method || "물과 함께",
                      warnings: "",
                      photo: ""
                    }
                  ]
                : [];
            })
          }
          placeholder="예: 빨간 알약"
        />
        <LabeledInput
          label="복약 시각"
          value={manual.sections.medication.drugs[0]?.timing ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              if (!draft.sections.medication.drugs[0]) {
                draft.sections.medication.drugs = [
                  {
                    name: "",
                    dosage: "1정",
                    timing: value,
                    method: "물과 함께",
                    warnings: "",
                    photo: ""
                  }
                ];
                return;
              }

              draft.sections.medication.drugs[0].timing = value;
            })
          }
          placeholder="예: 08:30"
        />
      </ScreenCard>

      <ScreenCard
        title={caregiverSectionContent[2].title}
        description={caregiverSectionContent[2].description}
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
      >
        <LabeledInput
          label="1차 릴레이 대상"
          value={manual.relay_targets[0]?.name ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              draft.relay_targets = value
                ? [
                    {
                      name: value,
                      relation: draft.relay_targets[0]?.relation || "가족",
                      contact: draft.relay_targets[0]?.contact || "",
                      priority: 1
                    }
                  ]
                : [];
            })
          }
          placeholder="예: 이모"
        />
        <LabeledInput
          label="릴레이 연락처"
          value={manual.relay_targets[0]?.contact ?? ""}
          onChangeText={(value) =>
            patchManual((draft) => {
              if (!draft.relay_targets[0]) {
                draft.relay_targets = [
                  {
                    name: "",
                    relation: "가족",
                    contact: value,
                    priority: 1
                  }
                ];
                return;
              }

              draft.relay_targets[0].contact = value;
            })
          }
          placeholder="예: 010-0000-0000"
        />
      </ScreenCard>

      <Pressable
        accessibilityRole="button"
        style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
        disabled={isSaving}
        onPress={() => void onSave(manual)}
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
  placeholder: string;
}

function LabeledInput({ label, value, onChangeText, placeholder }: LabeledInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
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
  hero: {
    borderRadius: 32,
    backgroundColor: "#183138",
    padding: 22,
    gap: 10
  },
  kicker: {
    color: "#cde0d7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  heading: {
    color: "#fffdf7",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36
  },
  heroBody: {
    color: "#d8e4df",
    fontSize: 15,
    lineHeight: 22
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
    color: "#526166"
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1b2c31"
  },
  input: {
    borderWidth: 1,
    borderColor: "#d9dfdf",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#f7f2e8",
    color: "#1b2c31"
  },
  primaryButton: {
    backgroundColor: "#c4684f",
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center"
  },
  primaryButtonDisabled: {
    opacity: 0.6
  },
  primaryButtonLabel: {
    color: "#fffdf7",
    fontSize: 16,
    fontWeight: "700"
  }
});
