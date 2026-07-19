import { StatusBar } from "expo-status-bar";
import { usePreventScreenCapture } from "expo-screen-capture";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileCareAppState } from "./src/state/useMobileCareAppState";
import { MobileCaregiverScreen } from "./src/ui/MobileCaregiverScreen";
import { MobileCompanionScreen } from "./src/ui/MobileCompanionScreen";
import { PrivacyGateScreen } from "./src/ui/PrivacyGateScreen";

export default function App() {
  usePreventScreenCapture("careguardian-sensitive-care-data");

  const {
    manual,
    mode,
    isLoaded,
    isSaving,
    isDeleting,
    isAuthenticating,
    privacyGate,
    statusMessage,
    actions
  } = useMobileCareAppState();

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingEmoji}>{"\u{1F91D}"}</Text>
        <Text style={styles.loadingTitle}>돌봄 환경을 준비하고 있어요...</Text>
        <Text style={styles.loadingSubtitle}>잠시만 기다려 주세요.</Text>
        <ActivityIndicator size="large" color="#6f8a70" />
      </View>
    );
  }

  if (privacyGate === "locked") {
    return (
      <PrivacyGateScreen
        message={statusMessage}
        isAuthenticating={isAuthenticating}
        onUnlock={actions.unlockSensitiveUi}
      />
    );
  }

  return (
    <View style={styles.screen} accessibilityLabel="돌봄 매뉴얼">
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.shell}>
          {mode === "caregiver" ? (
            <MobileCaregiverScreen
              manual={manual}
              isSaving={isSaving}
              statusMessage={statusMessage}
              onChange={actions.updateManual}
              onSave={actions.saveAndOpenCompanion}
            />
          ) : (
            <MobileCompanionScreen
              manual={manual}
              statusMessage={statusMessage}
              onBack={actions.openCaregiver}
              onResyncNotifications={actions.resyncNotifications}
              onDeleteAllData={actions.deleteAllData}
              isDeleting={isDeleting}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f4ecde"
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 28
  },
  shell: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center"
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: "#f4ecde"
  },
  loadingEmoji: {
    fontSize: 48
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a2626"
  },
  loadingSubtitle: {
    fontSize: 16,
    color: "#526166"
  }
});
