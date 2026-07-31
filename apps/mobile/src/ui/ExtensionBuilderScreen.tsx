import { useState } from "react";
import type { ExtensionDefinition } from "@life-steward/life-core";
import { validateExtension } from "@life-steward/life-core";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export function ExtensionBuilderScreen({ onCreate }: { onCreate(extension: ExtensionDefinition): void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const create = () => {
    const extension: ExtensionDefinition = { id: `extension-${Date.now()}`, title: title.trim(), fields: [], automations: [] };
    const validation = validateExtension(extension);
    if (!validation.ok) { setMessage("기능 이름을 확인해 주세요."); return; }
    onCreate(validation.value); setTitle(""); setMessage("새 기능을 작업공간에 추가했습니다.");
  };
  return <View style={styles.card}>
    <Text style={styles.title}>기능 만들기</Text>
    <Text style={styles.description}>목록, 기록, 알림에 쓸 개인 기능을 만듭니다.</Text>
    <TextInput value={title} onChangeText={setTitle} placeholder="예: 여행 준비" accessibilityLabel="새 기능 이름" style={styles.input} />
    <Pressable accessibilityRole="button" accessibilityLabel="기능 추가" style={styles.button} onPress={create}><Text style={styles.buttonText}>기능 추가</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 20, borderRadius: 20, backgroundColor: "#fffdf7" }, title: { fontSize: 22, fontWeight: "800", color: "#1a2626" }, description: { fontSize: 16, lineHeight: 23, color: "#526166" },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: "#cbd5d4", paddingHorizontal: 14, fontSize: 17, backgroundColor: "#fff" }, button: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#183138" }, buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 }, message: { color: "#3a4e54" }
});
