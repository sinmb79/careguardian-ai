import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  getOfflineLicenseAssetUri,
  getThirdPartyModelNotice
} from "../legal/thirdPartyModels";
import type { ModelArtifact } from "../local-ai/modelRegistry";

export function LocalAiSettingsScreen({
  model,
  onClose
}: {
  model: ModelArtifact;
  onClose(): void;
}) {
  const notice = getThirdPartyModelNotice(model.id);
  const [licenseText, setLicenseText] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("");

  const openLicense = async (assetIndex: number) => {
    const asset = notice?.licenseAssets[assetIndex];
    if (!asset) return;
    setLicenseStatus("기기에 포함된 라이선스를 여는 중입니다.");
    setLicenseText("");
    try {
      const uri = await getOfflineLicenseAssetUri(asset);
      const FileSystem = await import("expo-file-system/legacy");
      const text = await FileSystem.readAsStringAsync(uri);
      setLicenseText(text);
      setLicenseStatus(`${asset.id} 문서를 기기 안에서 열었습니다.`);
    } catch {
      setLicenseStatus("오프라인 라이선스 문서를 열지 못했습니다.");
    }
  };

  return (
    <View style={styles.container} accessibilityLabel={`${model.displayName} 모델 정보`}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.kicker}>MODEL & LICENSE</Text>
          <Text style={styles.title}>{model.displayName}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="모델 정보 닫기"
          style={styles.closeButton}
          onPress={onClose}
        >
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </View>

      {model.provider === "NAVER" ? (
        <Text style={styles.powered}>Powered by HyperCLOVA X</Text>
      ) : null}

      <View style={styles.metadata}>
        <Metadata label="제공자" value={model.provider} />
        <Metadata label="저장소" value={model.repository} />
        <Metadata label="고정 리비전" value={model.revision} />
        <Metadata label="라이선스" value={model.licenseName} />
        <Metadata
          label="모델 파일"
          value={model.artifactFileName ?? "검증된 GGUF 준비 중"}
        />
        <Metadata
          label="파일 크기"
          value={model.bytes ? `${(model.bytes / 1024 / 1024).toFixed(1)} MiB` : "미정"}
        />
        <Metadata label="SHA-256" value={model.sha256 ?? "미정"} />
      </View>

      <Text style={styles.notice}>
        라이선스와 금지 사용 정책은 앱에 포함되어 오프라인으로 열립니다. 출처 URL은
        확인용 텍스트이며 앱이 임의 모델이나 코드를 실행하는 링크로 사용하지 않습니다.
      </Text>

      <View style={styles.licenseButtons}>
        {notice?.licenseAssets.map((asset, index) => (
          <Pressable
            key={`${asset.id}-${asset.path}`}
            accessibilityRole="button"
            style={styles.licenseButton}
            onPress={() => void openLicense(index)}
          >
            <Text style={styles.licenseButtonText}>
              {asset.id === "license"
                ? "라이선스 전문"
                : asset.id === "notice"
                  ? "NOTICE"
                  : "금지 사용 정책"}
            </Text>
          </Pressable>
        ))}
      </View>

      {licenseStatus ? <Text style={styles.status}>{licenseStatus}</Text> : null}
      {licenseText ? (
        <ScrollView
          nestedScrollEnabled
          style={styles.licenseDocument}
          contentContainerStyle={styles.licenseDocumentContent}
          accessibilityLabel="오프라인 모델 라이선스 전문"
        >
          <Text selectable style={styles.licenseText}>
            {licenseText}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text selectable style={styles.metadataValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fffdf7",
    borderWidth: 1,
    borderColor: "#cbd8d4"
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  headingCopy: { flex: 1, gap: 4 },
  kicker: {
    color: "#6f8a70",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  title: { color: "#1a2626", fontSize: 22, fontWeight: "800" },
  closeButton: {
    minHeight: 44,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#e5ece9"
  },
  closeText: { color: "#264049", fontWeight: "800" },
  powered: { color: "#1f5f4b", fontWeight: "800", fontSize: 16 },
  metadata: { gap: 10 },
  metadataRow: { gap: 3 },
  metadataLabel: { color: "#647276", fontSize: 13, fontWeight: "700" },
  metadataValue: { color: "#26383d", fontSize: 14, lineHeight: 21 },
  notice: { color: "#526166", fontSize: 15, lineHeight: 22 },
  licenseButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  licenseButton: {
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#183138"
  },
  licenseButtonText: { color: "#fff", fontWeight: "800" },
  status: { color: "#3a4e54", fontSize: 14 },
  licenseDocument: {
    maxHeight: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7dfdc",
    backgroundColor: "#f8f6ef"
  },
  licenseDocumentContent: { padding: 14 },
  licenseText: {
    color: "#26383d",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "monospace"
  }
});
