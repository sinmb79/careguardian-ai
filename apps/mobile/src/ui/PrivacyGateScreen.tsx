import { Pressable, StyleSheet, Text, View } from "react-native";

interface PrivacyGateScreenProps {
  message: string;
  isAuthenticating: boolean;
  onUnlock: () => Promise<void>;
}

export function PrivacyGateScreen({ message, isAuthenticating, onUnlock }: PrivacyGateScreenProps) {
  return (
    <View style={styles.container} accessibilityLabel="개인정보 보호 잠금">
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>돌봄 정보가 잠겨 있습니다</Text>
      <Text style={styles.body}>
        저장된 프로필에는 건강·복약·연락처 정보가 포함될 수 있습니다. 기기의 생체 인증 또는 화면 잠금으로 확인해 주세요.
      </Text>
      <Text style={styles.status}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isAuthenticating ? "기기 인증 확인 중" : "기기 인증으로 잠금 해제"}
        disabled={isAuthenticating}
        onPress={() => void onUnlock()}
        style={[styles.button, isAuthenticating && styles.disabled]}
      >
        <Text style={styles.buttonText}>{isAuthenticating ? "인증 확인 중..." : "기기 인증으로 열기"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 28, backgroundColor: "#f4ecde" },
  icon: { fontSize: 48 },
  title: { fontSize: 25, fontWeight: "800", color: "#1a2626", textAlign: "center" },
  body: { fontSize: 17, lineHeight: 26, color: "#526166", textAlign: "center" },
  status: { fontSize: 15, lineHeight: 22, color: "#3a4e54", textAlign: "center" },
  button: { minHeight: 56, paddingHorizontal: 24, justifyContent: "center", borderRadius: 999, backgroundColor: "#183138" },
  buttonText: { color: "#fffdf7", fontSize: 17, fontWeight: "700" },
  disabled: { opacity: 0.55 }
});
