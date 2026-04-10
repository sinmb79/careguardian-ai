import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMobileCareAppState } from "./src/state/useMobileCareAppState";
import { MobileCaregiverScreen } from "./src/ui/MobileCaregiverScreen";
import { MobileCompanionScreen } from "./src/ui/MobileCompanionScreen";

export default function App() {
  const { manual, mode, isLoaded, isSaving, statusMessage, actions } = useMobileCareAppState();

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#183138" />
        <Text style={styles.loadingText}>돌봄 프로필을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
    gap: 12,
    backgroundColor: "#f4ecde"
  },
  loadingText: {
    fontSize: 15,
    color: "#4f5f64"
  }
});
