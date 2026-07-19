import { useMemo, useState } from "react";
import {
  buildDailyScheduleCards,
  generateCompanionReply,
  getTimeOfDayGreeting,
  getEmotionOptions
} from "@careguardian/care-core/companion";
import type { CareManual } from "@careguardian/care-core/manual";
import { buildMedicationTimeline } from "@careguardian/care-core/reminders";
import { buildRelayPackage } from "@careguardian/care-core/relay";
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { createMobileSpeechController } from "../voice/mobileSpeech";
import { MEDICATION_NOTIFICATION_DISCLOSURE } from "../notifications/notificationSchedule";
import { ScreenCard } from "./ScreenCard";

interface MobileCompanionScreenProps {
  manual: CareManual;
  statusMessage: string;
  onBack: () => void;
  onResyncNotifications: () => Promise<void>;
  onDeleteAllData: () => Promise<void>;
  isDeleting: boolean;
}

const PRIVACY_POLICY_URL = "https://sinmb79.github.io/careguardian-ai/privacy-policy.html";

export function MobileCompanionScreen({
  manual,
  statusMessage,
  onBack,
  onResyncNotifications,
  onDeleteAllData,
  isDeleting
}: MobileCompanionScreenProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const [message, setMessage] = useState("\uC624\uB298 \uBB50 \uD574?");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const speechController = useMemo(() => createMobileSpeechController(), []);
  const scheduleCards = useMemo(() => buildDailyScheduleCards(manual), [manual]);
  const medicationTimeline = useMemo(() => buildMedicationTimeline(manual, new Date()), [manual]);
  const relayPackage = useMemo(() => buildRelayPackage(manual), [manual]);
  const reply = useMemo(
    () =>
      generateCompanionReply({
        manual,
        message
      }),
    [manual, message]
  );
  const greeting = useMemo(
    () => getTimeOfDayGreeting(manual.subject.name || "\uC0AC\uC6A9\uC790"),
    [manual.subject.name]
  );
  const emotionOptions = useMemo(() => getEmotionOptions(), []);

  return (
    <View style={[styles.container, isTablet && styles.containerTablet]}>
      <View style={[styles.hero, isTablet && styles.fullSpan]}>
        <View style={styles.heroContent}>
          <Text style={styles.kicker}>Companion Mode</Text>
          <Text style={styles.heading}>{greeting}</Text>
          <Text style={styles.heroBody}>
            오늘 하루도 함께해요. 일정, 복약, 마음 점검이 준비되어 있습니다.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="보호자 편집으로 돌아가기"
          style={styles.secondaryButton}
          onPress={onBack}
        >
          <Text style={styles.secondaryButtonLabel}>보호자 편집</Text>
        </Pressable>
      </View>

      {statusMessage ? (
        <View style={[styles.statusBanner, isTablet && styles.fullSpan]}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      <ScreenCard title="오늘 기분은 어때요?" style={isTablet ? { width: "100%" } : undefined}>
        <Text style={styles.emotionPrompt}>느끼는 대로 하나 골라 주세요.</Text>
        <View style={styles.emotionRow}>
          {emotionOptions.map((opt) => (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              style={[
                styles.emotionButton,
                selectedEmotion === opt.value && styles.emotionButtonSelected
              ]}
              onPress={() => setSelectedEmotion(opt.value)}
            >
              <Text style={styles.emotionEmoji}>{opt.emoji}</Text>
              <Text style={styles.emotionLabel}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScreenCard>

      <ScreenCard title="오늘 일정 카드" style={isTablet ? { flexBasis: "48%" } : undefined}>
        {scheduleCards.map((card) => (
          <View key={card.id} style={styles.listItem}>
            <Text style={styles.itemTitle}>{card.title}</Text>
            <Text style={styles.itemBody}>{card.description}</Text>
          </View>
        ))}
      </ScreenCard>

      <ScreenCard
        title="복약 타임라인"
        style={isTablet ? { flexBasis: "48%" } : undefined}
        description={MEDICATION_NOTIFICATION_DISCLOSURE}
      >
        {medicationTimeline.length === 0 ? (
          <Text style={styles.emptyText}>아직 등록된 복약이 없습니다. 보호자 편집에서 약 정보를 추가해 주세요. 💊</Text>
        ) : (
          medicationTimeline.map((reminder) => (
            <View key={reminder.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{reminder.label}</Text>
              <Text style={styles.itemBody}>{reminder.detail}</Text>
              <Text style={styles.badge}>{reminder.status === "overdue" ? "지남" : "예정"}</Text>
            </View>
          ))
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="복약 알림 다시 예약하기"
          style={styles.secondaryCta}
          onPress={() => void onResyncNotifications()}
        >
          <Text style={styles.secondaryCtaLabel}>복약 알림 다시 예약</Text>
        </Pressable>
      </ScreenCard>

      <ScreenCard title="릴레이 준비도" style={isTablet ? { flexBasis: "48%" } : undefined}>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreValue}>{relayPackage.readinessScore}%</Text>
          <Text style={styles.scoreText}>{relayPackage.summary}</Text>
        </View>
        {relayPackage.keyActions.map((action, index) => (
          <View key={index} style={styles.outlinedItem}>
            <Text style={styles.itemBody}>{action}</Text>
          </View>
        ))}
      </ScreenCard>

      <ScreenCard title="말벗 응답" style={isTablet ? { flexBasis: "48%" } : undefined}>
        <View style={styles.field}>
          <Text style={styles.label}>지금 무엇이 필요해?</Text>
          <TextInput
            accessibilityLabel="말벗에게 질문 입력"
            value={message}
            onChangeText={setMessage}
            style={[styles.input, styles.messageInput]}
            placeholder="예: 오늘 뭐 해?"
            placeholderTextColor="#9aa7ab"
          />
        </View>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="음성으로 읽기"
            style={[styles.secondaryCta, !speechController.capabilities.canSpeak && styles.disabledButton]}
            onPress={() => speechController.speak(reply.reply)}
            disabled={!speechController.capabilities.canSpeak}
          >
            <Text style={styles.secondaryCtaLabel}>음성으로 읽기</Text>
          </Pressable>
          <View style={styles.listeningHint}>
            <Text style={styles.listeningHintText}>음성 듣기 입력은 다음 네이티브 플러그인 단계에서 연결합니다.</Text>
          </View>
        </View>
        <View style={styles.replyBox}>
          <Text style={styles.replyText}>{reply.reply}</Text>
        </View>
      </ScreenCard>

      <ScreenCard title="개인정보와 데이터 관리" style={isTablet ? { flexBasis: "48%" } : undefined}>
        <Text style={styles.itemBody}>
          돌봄 매뉴얼에는 연락처와 건강·복약 정보가 포함될 수 있습니다. 이 앱은 의료 진단이나 복약 지시를 대신하지 않으며, 알림은 기기 설정·권한·배터리 상태에 따라 놓칠 수 있습니다.
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="개인정보처리방침 열기"
          style={styles.policyButton}
          onPress={() =>
            void Linking.openURL(PRIVACY_POLICY_URL).catch(() =>
              Alert.alert("링크를 열 수 없습니다", "인터넷 연결을 확인한 뒤 다시 시도해 주세요.")
            )
          }
        >
          <Text style={styles.policyButtonText}>개인정보처리방침 보기</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDeleting ? "전체 데이터 삭제 중" : "이 기기의 전체 데이터 삭제"}
          disabled={isDeleting}
          style={[styles.deleteButton, isDeleting && styles.disabledButton]}
          onPress={() =>
            Alert.alert(
              "전체 데이터 삭제",
              "이 기기의 돌봄 프로필과 CareGuardian 복약 알림을 삭제합니다. 이 작업은 되돌릴 수 없습니다.",
              [
                { text: "취소", style: "cancel" },
                { text: "삭제", style: "destructive", onPress: () => void onDeleteAllData() }
              ]
            )
          }
        >
          <Text style={styles.deleteButtonText}>{isDeleting ? "삭제 중..." : "이 기기의 전체 데이터 삭제"}</Text>
        </Pressable>
      </ScreenCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16
  },
  containerTablet: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  fullSpan: {
    width: "100%"
  },
  hero: {
    borderRadius: 32,
    backgroundColor: "#8aa196",
    padding: 22,
    gap: 14
  },
  heroContent: {
    gap: 10
  },
  kicker: {
    color: "#eff7f1",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  heading: {
    color: "#0f2024",
    fontSize: 34,
    fontWeight: "800"
  },
  heroBody: {
    color: "#173036",
    fontSize: 18,
    lineHeight: 28
  },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "rgba(15, 32, 36, 0.12)",
    minHeight: 48
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#112126"
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
  emotionPrompt: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526166"
  },
  emotionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  emotionButton: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#f6efe3",
    minWidth: 72,
    minHeight: 56
  },
  emotionButtonSelected: {
    backgroundColor: "rgba(111, 138, 112, 0.2)",
    borderWidth: 2,
    borderColor: "#6f8a70"
  },
  emotionEmoji: {
    fontSize: 28
  },
  emotionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a2626"
  },
  listItem: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#f6efe3",
    gap: 6
  },
  outlinedItem: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#d9dfdf"
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a2626"
  },
  itemBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526166"
  },
  badge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#dbe7df",
    paddingHorizontal: 14,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#183138",
    overflow: "hidden"
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526166"
  },
  secondaryCta: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#1b2c31",
    alignItems: "center",
    minHeight: 52
  },
  secondaryCtaLabel: {
    color: "#fffdf7",
    fontSize: 16,
    fontWeight: "700"
  },
  policyButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6f8a70",
    borderRadius: 16
  },
  policyButtonText: {
    color: "#183138",
    fontSize: 16,
    fontWeight: "700"
  },
  deleteButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#9c3d32"
  },
  deleteButtonText: {
    color: "#fffdf7",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center"
  },
  scoreBox: {
    borderRadius: 20,
    backgroundColor: "#f6efe3",
    padding: 16,
    gap: 8
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: "800",
    color: "#1a2626"
  },
  scoreText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#526166"
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
  messageInput: {
    minHeight: 56
  },
  row: {
    gap: 12
  },
  listeningHint: {
    borderRadius: 16,
    backgroundColor: "#eef2ef",
    padding: 14
  },
  listeningHintText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4f5f64"
  },
  replyBox: {
    borderRadius: 20,
    backgroundColor: "#f7f2e8",
    padding: 18
  },
  replyText: {
    fontSize: 18,
    lineHeight: 28,
    color: "#1a2626"
  },
  disabledButton: {
    opacity: 0.5
  }
});
