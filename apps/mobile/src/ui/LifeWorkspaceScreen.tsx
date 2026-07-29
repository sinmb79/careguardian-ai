import type { PersonalWorkspace } from "@life-steward/life-core";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { LifeWorkspaceSection } from "../state/useLifeWorkspace";
import { ExtensionBuilderScreen } from "./ExtensionBuilderScreen";

const entries: Array<{ id: LifeWorkspaceSection; label: string }> = [
  { id: "today", label: "오늘" }, { id: "lists", label: "목록" }, { id: "extensions", label: "기능 만들기" },
  { id: "local-ai", label: "로컬 AI" }, { id: "settings", label: "설정" }
];

type Props = {
  workspace: PersonalWorkspace;
  section: LifeWorkspaceSection;
  statusMessage: string;
  isSaving: boolean;
  isDeleting: boolean;
  previousTestData: boolean;
  onChange(workspace: PersonalWorkspace): void;
  onSave(): Promise<void>;
  onDeleteAll(): Promise<void>;
  onDeletePreviousTestData(): Promise<void>;
  onOpenSection(section: LifeWorkspaceSection): void;
};

export function LifeWorkspaceScreen(props: Props) {
  const addExtension = (extension: PersonalWorkspace["extensions"][number]) => props.onChange({ ...props.workspace, extensions: [...props.workspace.extensions, extension] });
  return <View style={styles.container} accessibilityLabel="개인 생활 작업공간">
    <View style={styles.hero}><Text style={styles.kicker}>PERSONAL WORKSPACE</Text><Text style={styles.heading}>{props.workspace.title}</Text><Text style={styles.heroBody}>생활 작업, 목록, 개인 기능을 이 기기에 안전하게 보관합니다.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navigation} accessibilityRole="tablist">
      {entries.map((entry) => <Pressable key={entry.id} accessibilityRole="tab" accessibilityState={{ selected: props.section === entry.id }} style={[styles.tab, props.section === entry.id && styles.tabSelected]} onPress={() => props.onOpenSection(entry.id)}><Text style={[styles.tabText, props.section === entry.id && styles.tabTextSelected]}>{entry.label}</Text></Pressable>)}
    </ScrollView>
    {props.previousTestData ? <View style={styles.warning}><Text style={styles.warningTitle}>이전 테스트 데이터가 있습니다</Text><Text style={styles.warningBody}>자동으로 변환하지 않습니다. 삭제 후 새 개인 작업공간을 시작할 수 있습니다.</Text><Pressable style={styles.warningButton} onPress={() => void props.onDeletePreviousTestData()}><Text style={styles.warningButtonText}>이전 테스트 데이터 삭제 후 시작</Text></Pressable></View> : null}
    {props.statusMessage ? <View style={styles.status}><Text style={styles.statusText}>{props.statusMessage}</Text></View> : null}
    {props.section === "today" ? <View style={styles.card}><Text style={styles.cardTitle}>오늘</Text>{props.workspace.tasks.filter((task) => task.status === "open").length ? props.workspace.tasks.filter((task) => task.status === "open").map((task) => <Text key={task.id} style={styles.item}>• {task.title}{task.dueDate ? ` · ${task.dueDate}` : ""}</Text>) : <Text style={styles.body}>아직 열린 생활 작업이 없습니다.</Text>}</View> : null}
    {props.section === "lists" ? <View style={styles.card}><Text style={styles.cardTitle}>목록</Text>{props.workspace.lists.length ? props.workspace.lists.map((list) => <Text key={list.id} style={styles.item}>• {list.title}</Text>) : <Text style={styles.body}>개인 목록을 만들면 여기에 표시됩니다.</Text>}</View> : null}
    {props.section === "extensions" ? <ExtensionBuilderScreen onCreate={addExtension} /> : null}
    {props.section === "local-ai" ? <View style={styles.card}><Text style={styles.cardTitle}>로컬 AI</Text><Text style={styles.body}>로컬 AI 기능은 이 기기 안에서만 개인 작업공간을 도울 수 있도록 준비 중입니다.</Text></View> : null}
    {props.section === "settings" ? <View style={styles.card}><Text style={styles.cardTitle}>설정</Text><Text style={styles.body}>모든 데이터는 이 기기에서만 삭제할 수 있습니다.</Text><Pressable disabled={props.isDeleting} style={styles.deleteButton} onPress={() => Alert.alert("개인 작업공간 삭제", "이 기기의 모든 생활 작업과 일반 알림을 삭제합니다.", [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: () => void props.onDeleteAll() }])}><Text style={styles.deleteButtonText}>{props.isDeleting ? "삭제 중…" : "이 기기의 모든 데이터 삭제"}</Text></Pressable></View> : null}
    <Pressable disabled={props.isSaving} accessibilityRole="button" style={[styles.saveButton, props.isSaving && styles.disabled]} onPress={() => void props.onSave()}><Text style={styles.saveText}>{props.isSaving ? "저장 중…" : "변경 사항 저장"}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 }, hero: { gap: 8, padding: 22, borderRadius: 28, backgroundColor: "#183138" }, kicker: { color: "#cde0d7", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 }, heading: { color: "#fffdf7", fontSize: 30, fontWeight: "800" }, heroBody: { color: "#d8e4df", fontSize: 16, lineHeight: 24 },
  navigation: { gap: 8 }, tab: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 999, backgroundColor: "#e5ece9" }, tabSelected: { backgroundColor: "#6f8a70" }, tabText: { color: "#264049", fontWeight: "700" }, tabTextSelected: { color: "#fff" },
  status: { padding: 13, borderRadius: 14, backgroundColor: "#e8f0e9" }, statusText: { color: "#3a4e54", textAlign: "center" }, warning: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: "#fff4dd", borderWidth: 1, borderColor: "#d49433" }, warningTitle: { fontSize: 18, fontWeight: "800", color: "#533500" }, warningBody: { color: "#654d27", lineHeight: 22 }, warningButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#7b4a00" }, warningButtonText: { color: "#fff", fontWeight: "800" },
  card: { gap: 10, padding: 20, borderRadius: 20, backgroundColor: "#fffdf7" }, cardTitle: { fontSize: 22, fontWeight: "800", color: "#1a2626" }, body: { color: "#526166", fontSize: 16, lineHeight: 23 }, item: { color: "#26383d", fontSize: 17, lineHeight: 28 }, saveButton: { minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#c4684f" }, saveText: { color: "#fff", fontSize: 17, fontWeight: "800" }, deleteButton: { minHeight: 52, justifyContent: "center", alignItems: "center", borderRadius: 14, backgroundColor: "#9c3d32" }, deleteButtonText: { color: "#fff", fontWeight: "800" }, disabled: { opacity: 0.55 }
});
