import { StatusBar } from "expo-status-bar";
import { usePreventScreenCapture } from "expo-screen-capture";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLifeWorkspace } from "./src/state/useLifeWorkspace";
import { LifeWorkspaceScreen } from "./src/ui/LifeWorkspaceScreen";
import { PrivacyGateScreen } from "./src/ui/PrivacyGateScreen";

export default function App() {
  usePreventScreenCapture("life-steward-personal-workspace");
  const state = useLifeWorkspace();
  if (!state.isLoaded) return <View style={styles.loading}><Text style={styles.loadingTitle}>개인 작업공간을 준비하고 있습니다.</Text><ActivityIndicator size="large" color="#6f8a70" /></View>;
  if (state.privacyGate === "locked") return <PrivacyGateScreen message={state.statusMessage} isAuthenticating={state.isAuthenticating} onUnlock={state.actions.unlock} />;
  return <View style={styles.screen} accessibilityLabel="개인 생활 작업공간"><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.scroll}><View style={styles.shell}><LifeWorkspaceScreen workspace={state.workspace} section={state.section} statusMessage={state.statusMessage} isSaving={state.isSaving} isDeleting={state.isDeleting} previousTestData={state.previousTestData} onChange={state.actions.updateWorkspace} onSave={state.actions.save} onDeleteAll={state.actions.deleteAllData} onDeletePreviousTestData={state.actions.deletePreviousTestData} onOpenSection={state.actions.openSection} /></View></ScrollView></View>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#f4ecde" }, scroll: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 28 }, shell: { width: "100%", maxWidth: 820, alignSelf: "center" }, loading: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, backgroundColor: "#f4ecde" }, loadingTitle: { fontSize: 19, fontWeight: "700", color: "#1a2626" } });
