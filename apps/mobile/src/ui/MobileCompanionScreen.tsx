import { useMemo, useState } from "react";
import {
  buildDailyScheduleCards,
  generateCompanionReply
} from "@careguardian/care-core/companion";
import type { CareManual } from "@careguardian/care-core/manual";
import { buildMedicationTimeline } from "@careguardian/care-core/reminders";
import { buildRelayPackage } from "@careguardian/care-core/relay";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createMobileSpeechController } from "../voice/mobileSpeech";
import { ScreenCard } from "./ScreenCard";

interface MobileCompanionScreenProps {
  manual: CareManual;
  statusMessage: string;
  onBack: () => void;
  onResyncNotifications: () => Promise<void>;
}

export function MobileCompanionScreen({
  manual,
  statusMessage,
  onBack,
  onResyncNotifications
}: MobileCompanionScreenProps) {
  const [message, setMessage] = useState("오늘 뭐 해?");
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

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <Text style={styles.kicker}>Companion Mode</Text>
          <Text style={styles.heading}>오늘의 돌봄 동반자</Text>
          <Text style={styles.heroBody}>
            {manual.subject.name || "이름 없는 사용자"}를 위한 일정, 복약, 진정 힌트를 바로 확인할 수 있습니다.
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonLabel}>보호자 편집</Text>
        </Pressable>
      </View>

      <Text style={styles.status}>{statusMessage}</Text>

      <ScreenCard title="오늘 일정 카드">
        {scheduleCards.map((card) => (
          <View key={card.id} style={styles.listItem}>
            <Text style={styles.itemTitle}>{card.title}</Text>
            <Text style={styles.itemBody}>{card.description}</Text>
          </View>
        ))}
      </ScreenCard>

      <ScreenCard title="복약 타임라인" description="저장 시 가장 가까운 다음 복약 시점으로 알림을 예약합니다.">
        {medicationTimeline.length === 0 ? (
          <Text style={styles.emptyText}>아직 등록된 복약이 없습니다.</Text>
        ) : (
          medicationTimeline.map((reminder) => (
            <View key={reminder.id} style={styles.listItem}>
              <Text style={styles.itemTitle}>{reminder.label}</Text>
              <Text style={styles.itemBody}>{reminder.detail}</Text>
              <Text style={styles.badge}>{reminder.status === "overdue" ? "지남" : "예정"}</Text>
            </View>
          ))
        )}
        <Pressable style={styles.secondaryCta} onPress={() => void onResyncNotifications()}>
          <Text style={styles.secondaryCtaLabel}>복약 알림 다시 예약</Text>
        </Pressable>
      </ScreenCard>

      <ScreenCard title="릴레이 준비도">
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

      <ScreenCard title="말벗 응답">
        <View style={styles.field}>
          <Text style={styles.label}>지금 무엇이 필요해?</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={[styles.input, styles.messageInput]}
            placeholder="예: 오늘 뭐 해?"
            placeholderTextColor="#9aa7ab"
          />
        </View>
        <View style={styles.row}>
          <Pressable
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
          <Text style={styles.itemBody}>{reply.reply}</Text>
        </View>
      </ScreenCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16
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
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase"
  },
  heading: {
    color: "#0f2024",
    fontSize: 30,
    fontWeight: "800"
  },
  heroBody: {
    color: "#173036",
    fontSize: 15,
    lineHeight: 22
  },
  secondaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15, 32, 36, 0.12)"
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#112126"
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
    color: "#526166"
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
    borderWidth: 1,
    borderColor: "#d9dfdf"
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1b2c31"
  },
  itemBody: {
    fontSize: 14,
    lineHeight: 21,
    color: "#526166"
  },
  badge: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#dbe7df",
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "700",
    color: "#183138"
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#526166"
  },
  secondaryCta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#1b2c31"
  },
  secondaryCtaLabel: {
    color: "#fffdf7",
    fontSize: 14,
    fontWeight: "700"
  },
  scoreBox: {
    borderRadius: 20,
    backgroundColor: "#f6efe3",
    padding: 16,
    gap: 8
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: "800",
    color: "#1b2c31"
  },
  scoreText: {
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 13,
    lineHeight: 18,
    color: "#4f5f64"
  },
  replyBox: {
    borderRadius: 20,
    backgroundColor: "#f7f2e8",
    padding: 16
  },
  disabledButton: {
    opacity: 0.5
  }
});
