import type { PersonalWorkspace } from "@life-steward/life-core";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { LifeWorkspaceSection } from "../state/useLifeWorkspace";
import { ExtensionBuilderScreen } from "./ExtensionBuilderScreen";
import { LocalAiScreen } from "./LocalAiScreen";
import { observeDeleteAll } from "./deletionUi";
import { openPrivacyPolicy } from "../legal/externalLinking";
import { addWorkspaceList, addWorkspaceTask, createMobileWorkspaceEntryDependencies } from "./workspaceEntry";

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
  const [privacyPolicyStatus, setPrivacyPolicyStatus] = useState("");
  const addExtension = (extension: PersonalWorkspace["extensions"][number]) => props.onChange({ ...props.workspace, extensions: [...props.workspace.extensions, extension] });
  const openPrivacyPolicyPage = async () => {
    setPrivacyPolicyStatus("");
    const result = await openPrivacyPolicy();
    if (!result.ok) {
      setPrivacyPolicyStatus("개인정보처리방침을 열지 못했습니다. 아래 오프라인 안내는 계속 확인할 수 있습니다.");
    }
  };
  return <View style={styles.container} accessibilityLabel="개인 생활 작업공간">
    <View style={styles.hero}><Text style={styles.kicker}>PERSONAL WORKSPACE</Text><Text style={styles.heading}>{props.workspace.title}</Text><Text style={styles.heroBody}>생활 작업, 목록, 개인 기능을 이 기기에 안전하게 보관합니다.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navigation} accessibilityRole="tablist">
      {entries.map((entry) => <Pressable key={entry.id} accessibilityRole="tab" accessibilityState={{ selected: props.section === entry.id }} style={[styles.tab, props.section === entry.id && styles.tabSelected]} onPress={() => props.onOpenSection(entry.id)}><Text style={[styles.tabText, props.section === entry.id && styles.tabTextSelected]}>{entry.label}</Text></Pressable>)}
    </ScrollView>
    {props.previousTestData ? <View style={styles.warning}><Text style={styles.warningTitle}>이전 테스트 데이터가 있습니다</Text><Text style={styles.warningBody}>자동으로 변환하지 않습니다. 삭제 후 새 개인 작업공간을 시작할 수 있습니다.</Text><Pressable style={styles.warningButton} onPress={() => void props.onDeletePreviousTestData()}><Text style={styles.warningButtonText}>이전 테스트 데이터 삭제 후 시작</Text></Pressable></View> : null}
    {props.statusMessage ? <View style={styles.status}><Text style={styles.statusText}>{props.statusMessage}</Text></View> : null}
    {props.section === "today" ? <View style={styles.card}><Text style={styles.cardTitle}>오늘</Text>{props.workspace.tasks.filter((task) => task.status === "open").length ? props.workspace.tasks.filter((task) => task.status === "open").map((task) => <Text key={task.id} style={styles.item}>• {task.title}{task.dueDate ? ` · ${task.dueDate}` : ""}</Text>) : <Text style={styles.body}>아직 열린 생활 작업이 없습니다.</Text>}</View> : null}
    {props.section === "lists" ? <View style={styles.card}><Text style={styles.cardTitle}>목록</Text>{props.workspace.lists.length ? props.workspace.lists.map((list) => <Text key={list.id} style={styles.item}>• {list.title}</Text>) : <Text style={styles.body}>개인 목록을 만들면 여기에 표시됩니다.</Text>}</View> : null}
    {props.section === "today" ? <WorkspaceEntryForm mode="task" workspace={props.workspace} onChange={props.onChange} /> : null}
    {props.section === "lists" ? <WorkspaceEntryForm mode="list" workspace={props.workspace} onChange={props.onChange} /> : null}
    {props.section === "extensions" ? <ExtensionBuilderScreen onCreate={addExtension} /> : null}
    {props.section === "local-ai" ? <LocalAiScreen workspace={props.workspace} onChange={props.onChange} /> : null}
    {props.section === "settings" ? <View style={styles.card}>
      <Text style={styles.cardTitle}>설정</Text>
      <Text style={styles.body}>모든 데이터는 이 기기에서만 삭제할 수 있습니다.</Text>
      <View style={styles.privacyDisclosure}>
        <Text style={styles.privacyDisclosureTitle}>개인정보처리방침</Text>
        <Text style={styles.body}>로그인·광고·분석 SDK·외부 AI 처리 서비스를 사용하지 않습니다. 작업·목록·사용자 기능·프롬프트·결과는 이 기기에 저장됩니다.</Text>
        <Text style={styles.body}>모델 설치를 사용자가 선택한 경우에만 Hugging Face에 네트워크 요청이 발생합니다.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="개인정보처리방침 열기" style={styles.privacyPolicyButton} onPress={() => void openPrivacyPolicyPage()}><Text style={styles.privacyPolicyButtonText}>개인정보처리방침 열기</Text></Pressable>
        {privacyPolicyStatus ? <Text accessibilityLiveRegion="polite" style={styles.entryError}>{privacyPolicyStatus}</Text> : null}
      </View>
      <Pressable disabled={props.isDeleting} style={styles.deleteButton} onPress={() => Alert.alert("이 기기의 모든 데이터 삭제", "진행 중인 로컬 AI를 중단하고 모델·부분 다운로드·생활 작업·일반 알림을 이 기기에서 삭제합니다.", [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: () => observeDeleteAll(props.onDeleteAll) }])}><Text style={styles.deleteButtonText}>{props.isDeleting ? "삭제 중…" : "이 기기의 모든 데이터 삭제"}</Text></Pressable>
    </View> : null}
    <Pressable disabled={props.isSaving || props.isDeleting} accessibilityRole="button" style={[styles.saveButton, (props.isSaving || props.isDeleting) && styles.disabled]} onPress={() => void props.onSave()}><Text style={styles.saveText}>{props.isSaving ? "저장 중…" : "변경 사항 저장"}</Text></Pressable>
  </View>;
}

type WorkspaceEntryFormProps = {
  mode: "task" | "list";
  workspace: PersonalWorkspace;
  onChange(workspace: PersonalWorkspace): void;
};

function WorkspaceEntryForm({ mode, workspace, onChange }: WorkspaceEntryFormProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const isTask = mode === "task";
  const add = () => {
    const result = isTask
      ? addWorkspaceTask(workspace, title, createMobileWorkspaceEntryDependencies())
      : addWorkspaceList(workspace, title, createMobileWorkspaceEntryDependencies());
    if (!result.ok) return setError(result.error);
    onChange(result.workspace);
    setTitle("");
    setError("");
  };
  const label = isTask ? "새 작업" : "새 개인 목록";
  return <View style={styles.entryForm}>
    <Text style={styles.entryLabel}>{label}</Text>
    <TextInput value={title} onChangeText={(value) => { setTitle(value); setError(""); }} placeholder={isTask ? "무엇을 해야 하나요?" : "목록 이름"} accessibilityLabel={`${label} 제목`} style={styles.entryInput} maxLength={501} />
    <Pressable accessibilityRole="button" accessibilityLabel={`새 ${isTask ? "작업" : "개인 목록"} 추가`} style={styles.entryButton} onPress={add}><Text style={styles.entryButtonText}>{isTask ? "작업 추가" : "목록 추가"}</Text></Pressable>
    {error ? <Text accessibilityLiveRegion="polite" style={styles.entryError}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 }, hero: { gap: 8, padding: 22, borderRadius: 28, backgroundColor: "#183138" }, kicker: { color: "#cde0d7", fontSize: 12, fontWeight: "800", letterSpacing: 1.4 }, heading: { color: "#fffdf7", fontSize: 30, fontWeight: "800" }, heroBody: { color: "#d8e4df", fontSize: 16, lineHeight: 24 },
  navigation: { gap: 8 }, tab: { minHeight: 44, paddingHorizontal: 16, justifyContent: "center", borderRadius: 999, backgroundColor: "#e5ece9" }, tabSelected: { backgroundColor: "#6f8a70" }, tabText: { color: "#264049", fontWeight: "700" }, tabTextSelected: { color: "#fff" },
  status: { padding: 13, borderRadius: 14, backgroundColor: "#e8f0e9" }, statusText: { color: "#3a4e54", textAlign: "center" }, warning: { gap: 8, padding: 18, borderRadius: 18, backgroundColor: "#fff4dd", borderWidth: 1, borderColor: "#d49433" }, warningTitle: { fontSize: 18, fontWeight: "800", color: "#533500" }, warningBody: { color: "#654d27", lineHeight: 22 }, warningButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#7b4a00" }, warningButtonText: { color: "#fff", fontWeight: "800" },
  card: { gap: 10, padding: 20, borderRadius: 20, backgroundColor: "#fffdf7" }, cardTitle: { fontSize: 22, fontWeight: "800", color: "#1a2626" }, body: { color: "#526166", fontSize: 16, lineHeight: 23 }, item: { color: "#26383d", fontSize: 17, lineHeight: 28 }, privacyDisclosure: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: "#edf3ef", borderWidth: 1, borderColor: "#cbd8d4" }, privacyDisclosureTitle: { color: "#26383d", fontSize: 17, fontWeight: "800" }, privacyPolicyButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#315f55" }, privacyPolicyButtonText: { color: "#fff", fontWeight: "800" }, entryForm: { gap: 8, padding: 14, borderRadius: 14, backgroundColor: "#edf3ef" }, entryLabel: { color: "#26383d", fontWeight: "700" }, entryInput: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderColor: "#9baea5", borderRadius: 10, color: "#1a2626", backgroundColor: "#fff" }, entryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#416d59" }, entryButtonText: { color: "#fff", fontWeight: "800" }, entryError: { color: "#9c3d32", fontWeight: "600" }, saveButton: { minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "#c4684f" }, saveText: { color: "#fff", fontSize: 17, fontWeight: "800" }, deleteButton: { minHeight: 52, justifyContent: "center", alignItems: "center", borderRadius: 14, backgroundColor: "#9c3d32" }, deleteButtonText: { color: "#fff", fontWeight: "800" }, disabled: { opacity: 0.55 }
});
