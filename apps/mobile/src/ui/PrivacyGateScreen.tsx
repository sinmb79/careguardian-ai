import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PrivacyGateRecoveryMode } from "../security/privacyGate";
import { observeDeleteAll } from "./deletionUi";

interface PrivacyGateScreenProps {
  message: string;
  isAuthenticating: boolean;
  isDeleting: boolean;
  recoveryMode: PrivacyGateRecoveryMode;
  onUnlock: () => Promise<void>;
  onRetryDelete: () => Promise<void>;
}

export function PrivacyGateScreen({
  message,
  isAuthenticating,
  isDeleting,
  recoveryMode,
  onUnlock,
  onRetryDelete
}: PrivacyGateScreenProps) {
  const body = recoveryMode === "restart-required"
    ? "로컬 AI 실행 상태를 안전하게 해제하려면 앱을 완전히 종료한 뒤 다시 열어야 합니다."
    : recoveryMode === "retry-delete"
      ? "개인 작업공간은 잠긴 상태입니다. 남아 있을 수 있는 로컬 데이터 삭제를 다시 시도해 주세요."
      : "저장된 내용은 이 기기의 인증을 거쳐야 열 수 있습니다.";
  return <View style={styles.container} accessibilityLabel="개인 작업공간 잠금">
    <Text style={styles.icon}>🔒</Text>
    <Text style={styles.title}>개인 작업공간이 잠겨 있습니다</Text>
    <Text style={styles.body}>{body}</Text>
    <Text style={styles.status}>{message}</Text>
    {recoveryMode === "retry-delete" ? (
      <Pressable accessibilityRole="button" accessibilityLabel="남은 데이터 삭제 다시 시도" disabled={isDeleting} onPress={() => observeDeleteAll(onRetryDelete)} style={[styles.deleteButton, isDeleting && styles.disabled]}>
        <Text style={styles.buttonText}>{isDeleting ? "삭제 재시도 중…" : "남은 데이터 삭제 다시 시도"}</Text>
      </Pressable>
    ) : recoveryMode === null ? (
      <Pressable accessibilityRole="button" accessibilityLabel="기기 인증으로 열기" disabled={isAuthenticating} onPress={() => void onUnlock()} style={[styles.button, isAuthenticating && styles.disabled]}>
        <Text style={styles.buttonText}>{isAuthenticating ? "인증 확인 중…" : "기기 인증으로 열기"}</Text>
      </Pressable>
    ) : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 28, backgroundColor: "#f4ecde" },
  icon: { fontSize: 48 }, title: { fontSize: 25, fontWeight: "800", color: "#1a2626", textAlign: "center" },
  body: { fontSize: 17, lineHeight: 26, color: "#526166", textAlign: "center" }, status: { fontSize: 15, lineHeight: 22, color: "#3a4e54", textAlign: "center" },
  button: { minHeight: 56, paddingHorizontal: 24, justifyContent: "center", borderRadius: 999, backgroundColor: "#183138" },
  deleteButton: { minHeight: 56, paddingHorizontal: 24, justifyContent: "center", borderRadius: 999, backgroundColor: "#9c3d32" },
  buttonText: { color: "#fffdf7", fontSize: 17, fontWeight: "700" }, disabled: { opacity: 0.55 }
});
