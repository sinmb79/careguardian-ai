import type { AiAction, PersonalWorkspace } from "@life-steward/life-core";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { ModelArtifact } from "../local-ai/modelRegistry";
import { hasRequiredMemory } from "../local-ai/llamaRuntime";
import type {
  DownloadState,
  InstalledModel,
  ModelInstallationStatus
} from "../local-ai/modelStore";
import {
  type LocalAiErrorKind,
  useLocalAssistant
} from "../local-ai/useLocalAssistant";
import { LocalAiSettingsScreen } from "./LocalAiSettingsScreen";

const ACTIONS: ReadonlyArray<{
  id: AiAction;
  label: string;
  description: string;
}> = [
  { id: "summarize", label: "요약", description: "기존 텍스트의 핵심만 정리" },
  {
    id: "rewriteText",
    label: "문장 다듬기",
    description: "뜻을 바꾸지 않고 읽기 쉽게 정리"
  },
  {
    id: "suggestTitle",
    label: "제목 제안",
    description: "중립적인 제목 하나 제안"
  },
  {
    id: "draftChecklist",
    label: "체크리스트 초안",
    description: "입력에 있는 항목만 목록으로 정리"
  }
];

export function LocalAiScreen({
  workspace,
  onChange
}: {
  workspace: PersonalWorkspace;
  onChange(workspace: PersonalWorkspace): void;
}) {
  const assistant = useLocalAssistant(onChange);
  const [detailModel, setDetailModel] = useState<ModelArtifact | null>(null);
  const [screenMessage, setScreenMessage] = useState("");

  const run = async (operation: () => Promise<unknown>) => {
    setScreenMessage("");
    try {
      await operation();
    } catch {
      setScreenMessage("작업을 완료하지 못했습니다. 아래 상태 안내를 확인해 주세요.");
    }
  };

  const approve = () => {
    setScreenMessage("");
    try {
      assistant.actions.approve(workspace);
    } catch {
      setScreenMessage(
        "결과가 작업공간 검증 범위를 벗어났습니다. 폐기한 뒤 더 짧게 다시 정리해 주세요."
      );
    }
  };

  if (detailModel) {
    return (
      <LocalAiSettingsScreen
        model={detailModel}
        onClose={() => setDetailModel(null)}
      />
    );
  }

  return (
    <View style={styles.container} accessibilityLabel="기기 내 로컬 AI 문서 정리">
      <View style={styles.hero}>
        <Text style={styles.kicker}>ON-DEVICE DOCUMENT TOOLS</Text>
        <Text style={styles.heading}>로컬 AI</Text>
        <Text style={styles.heroBody}>
          자유 대화형 챗봇이 아닙니다. 선택한 텍스트에 요약, 문장 다듬기, 제목
          제안, 체크리스트 초안 네 가지 작업만 제공합니다.
        </Text>
        <Text style={styles.privacy}>
          입력과 결과는 외부 AI 서버로 보내지 않습니다. 모델 설치를 선택하면 고정된
          Hugging Face 파일을 내려받기 위한 외부 네트워크 연결만 발생합니다.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>실행 환경</Text>
        <Text style={styles.noticeText}>
          {assistant.environmentSupport === "checking"
            ? "64비트 Android 지원 여부를 확인하고 있습니다."
            : assistant.environmentSupport === "supported"
              ? `지원되는 64비트 Android 환경입니다 (${assistant.environmentArchitectures.join(", ")}).`
              : "이 환경에서는 로컬 AI를 실행하거나 모델을 설치할 수 없습니다. 일반 생활 기능은 그대로 사용할 수 있습니다."}
        </Text>
        <Text style={styles.noticeSubtext}>
          네이티브 실행 모듈이 필요하므로 Expo Go에서는 실행되지 않으며 개발 빌드 또는
          배포 빌드가 필요합니다. 첫 버전은 CPU만 사용합니다.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. 검증된 모델 선택</Text>
        <Text style={styles.sectionDescription}>
          앱의 고정 레지스트리에 있는 리비전, 크기, SHA-256과 일치하는 파일만
          실행합니다.
        </Text>
        <View style={styles.modelGrid}>
          {assistant.models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              installation={assistant.installationStatuses.find(
                (status) =>
                  (status.kind === "ready"
                    ? status.installed.modelId
                    : status.modelId) === model.id
              )}
              downloadState={assistant.downloadStates[model.id]}
              accepted={assistant.acceptedLicenseModelIds.has(model.id)}
              environmentSupported={assistant.environmentSupport === "supported"}
              memorySupported={hasRequiredMemory(
                model,
                assistant.environmentTotalMemoryBytes
              )}
              interactionDisabled={assistant.isGenerating}
              activeDownloadModelId={assistant.activeDownloadModelId}
              activeSessionModelId={assistant.session?.modelId ?? null}
              onToggleAcceptance={() =>
                assistant.actions.toggleLicenseAcceptance(model.id)
              }
              onInstall={() => void run(() => assistant.actions.installModel(model))}
              onPause={() => void run(assistant.actions.pauseDownload)}
              onResume={() => void run(() => assistant.actions.resumeDownload(model))}
              onCancel={() =>
                void run(() => assistant.actions.cancelDownload(model.id))
              }
              onLoad={(installed) =>
                void run(() => assistant.actions.loadModel(installed))
              }
              onDelete={() => void run(() => assistant.actions.deleteModel(model.id))}
              onOpenDetails={() => setDetailModel(model)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. 문서 정리 동작</Text>
        <View style={styles.actionGrid} accessibilityRole="radiogroup">
          {ACTIONS.map((action) => (
            <Pressable
              key={action.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: assistant.action === action.id }}
              disabled={assistant.isGenerating}
              style={[
                styles.actionCard,
                assistant.action === action.id && styles.actionCardSelected
              ]}
              onPress={() => assistant.actions.setAction(action.id)}
            >
              <Text
                style={[
                  styles.actionLabel,
                  assistant.action === action.id && styles.actionLabelSelected
                ]}
              >
                {action.label}
              </Text>
              <Text
                style={[
                  styles.actionDescription,
                  assistant.action === action.id &&
                    styles.actionDescriptionSelected
                ]}
              >
                {action.description}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={assistant.input}
          onChangeText={assistant.actions.setInput}
          editable={!assistant.isGenerating}
          multiline
          maxLength={6000}
          textAlignVertical="top"
          accessibilityLabel="정리할 일반 생활 텍스트"
          placeholder="정리할 일반 일정, 메모, 준비물 내용을 직접 입력하세요."
          style={styles.input}
        />
        <Text style={styles.policyText}>
          건강·약물·증상·진단·치료·응급, 위해·착취·사기·괴롭힘·악성 코드·불법행위
          요청과 결과는 처리하지 않습니다.
        </Text>

        {assistant.isGenerating ? (
          <Pressable
            accessibilityRole="button"
            style={styles.cancelButton}
            onPress={() => void run(assistant.actions.cancelGeneration)}
          >
            <Text style={styles.cancelButtonText}>생성 취소 및 모델 해제</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!assistant.session || assistant.input.trim().length === 0}
            accessibilityState={{
              disabled: !assistant.session || assistant.input.trim().length === 0
            }}
            style={[
              styles.primaryButton,
              (!assistant.session || assistant.input.trim().length === 0) &&
                styles.disabled
            ]}
            onPress={() => void run(assistant.actions.generate)}
          >
            <Text style={styles.primaryButtonText}>
              {assistant.session ? "기기 안에서 정리 시작" : "먼저 설치 모델 불러오기"}
            </Text>
          </Pressable>
        )}
      </View>

      {assistant.preview ? (
        <View style={styles.previewCard}>
          <Text style={styles.sectionTitle}>3. 결과 미리보기</Text>
          <Text style={styles.previewWarning}>
            자동 저장하거나 기존 내용을 덮어쓰지 않습니다. 확인 후에만 반영하세요.
          </Text>
          <Text selectable style={styles.previewText}>
            {assistant.preview}
          </Text>
          {assistant.result ? (
            <View style={styles.buttonRow}>
              <Pressable style={styles.approveButton} onPress={approve}>
                <Text style={styles.approveButtonText}>승인 후 작업공간에 반영</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={assistant.actions.discard}
              >
                <Text style={styles.secondaryButtonText}>삭제</Text>
              </Pressable>
              <Pressable
                style={styles.problemButton}
                onPress={assistant.actions.flagProblem}
              >
                <Text style={styles.problemButtonText}>
                  문제 있는 결과로 표시하고 폐기
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {assistant.errorKind ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>상태 확인 필요</Text>
          <Text style={styles.errorText}>
            {errorMessage(assistant.errorKind)}
          </Text>
        </View>
      ) : null}
      {screenMessage ? <Text style={styles.screenMessage}>{screenMessage}</Text> : null}
      <Text style={styles.status}>{assistant.statusMessage}</Text>
      <Text style={styles.powered}>Powered by HyperCLOVA X</Text>
    </View>
  );
}

type ModelCardProps = {
  model: ModelArtifact;
  installation?: ModelInstallationStatus;
  downloadState?: DownloadState;
  accepted: boolean;
  environmentSupported: boolean;
  memorySupported: boolean;
  interactionDisabled: boolean;
  activeDownloadModelId: string | null;
  activeSessionModelId: string | null;
  onToggleAcceptance(): void;
  onInstall(): void;
  onPause(): void;
  onResume(): void;
  onCancel(): void;
  onLoad(installed: InstalledModel): void;
  onDelete(): void;
  onOpenDetails(): void;
};

function ModelCard(props: ModelCardProps) {
  const {
    model,
    installation,
    downloadState,
    accepted,
    environmentSupported,
    memorySupported,
    interactionDisabled,
    activeDownloadModelId,
    activeSessionModelId
  } = props;
  const isRecommended = model.id.includes("0.5b");
  const isDownloading =
    activeDownloadModelId === model.id &&
    (downloadState?.kind === "downloading" || !downloadState);
  const isPaused = downloadState?.kind === "paused";
  const progress =
    downloadState?.kind === "downloading" && downloadState.totalBytes
      ? Math.min(
          100,
          Math.round(
            (downloadState.bytesWritten / downloadState.totalBytes) * 100
          )
        )
      : null;

  return (
    <View style={styles.modelCard}>
      <View style={styles.modelHeader}>
        <Text style={styles.modelProvider}>{model.provider}</Text>
        {isRecommended ? <Text style={styles.badge}>권장</Text> : null}
      </View>
      <Text style={styles.modelName}>{model.displayName}</Text>
      <Text style={styles.modelDescription}>
        {isRecommended
          ? "4GB 이상 기기를 위한 경량 모델"
          : model.provider === "NAVER"
            ? "6GB 이상 고사양 기기를 위한 균형 모델"
            : "공식 또는 내부 승인 GGUF가 없어 검증 준비 중"}
      </Text>
      <Text style={styles.modelMeta}>
        RAM {model.minimumRamGb}GB 이상 · 문맥 {model.appDefaultContextTokens} tokens
      </Text>
      <Text style={styles.modelMeta}>
        {model.bytes
          ? `${(model.bytes / 1024 / 1024).toFixed(1)} MiB`
          : "다운로드 파일 미승인"}
      </Text>

      <Pressable
        accessibilityRole="button"
        style={styles.detailsButton}
        disabled={interactionDisabled}
        accessibilityState={{ disabled: interactionDisabled }}
        onPress={props.onOpenDetails}
      >
        <Text style={styles.detailsButtonText}>라이선스·출처·무결성 정보</Text>
      </Pressable>

      {model.availability !== "installable" ? (
        <View style={styles.blockedState}>
          <Text style={styles.blockedText}>검증 준비 중 · 다운로드 버튼 없음</Text>
        </View>
      ) : null}

      {model.availability === "installable" &&
      installation?.kind !== "ready" &&
      installation?.kind !== "invalid" &&
      !isDownloading &&
      !isPaused &&
      downloadState?.kind !== "verifying" ? (
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            style={styles.consentRow}
            onPress={props.onToggleAcceptance}
          >
            <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
              <Text style={styles.checkboxMark}>{accepted ? "✓" : ""}</Text>
            </View>
            <Text style={styles.consentText}>
              라이선스·금지 사용 정책과 외부 모델 다운로드 네트워크 연결을 확인하고
              동의합니다.
            </Text>
          </Pressable>
          <Pressable
            disabled={
              !accepted ||
              !environmentSupported ||
              !memorySupported ||
              interactionDisabled
            }
            accessibilityState={{
              disabled:
                !accepted ||
                !environmentSupported ||
                !memorySupported ||
                interactionDisabled
            }}
            style={[
              styles.installButton,
              (!accepted ||
                !environmentSupported ||
                !memorySupported ||
                interactionDisabled) &&
                styles.disabled
            ]}
            onPress={props.onInstall}
          >
            <Text style={styles.installButtonText}>모델 다운로드 및 검증</Text>
          </Pressable>
          {!memorySupported ? (
            <Text style={styles.errorText}>
              확인 가능한 기기 RAM이 이 모델의 최소 {model.minimumRamGb}GB보다
              부족하여 설치와 실행을 차단했습니다.
            </Text>
          ) : null}
        </>
      ) : null}

      {isDownloading ? (
        <View style={styles.downloadState}>
          <Text style={styles.downloadText}>
            내려받는 중{progress === null ? "" : ` · ${progress}%`}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              disabled={interactionDisabled}
              style={[styles.secondaryButton, interactionDisabled && styles.disabled]}
              onPress={props.onPause}
            >
              <Text style={styles.secondaryButtonText}>일시정지</Text>
            </Pressable>
            <Pressable
              disabled={interactionDisabled}
              style={[styles.problemButton, interactionDisabled && styles.disabled]}
              onPress={props.onCancel}
            >
              <Text style={styles.problemButtonText}>취소 및 부분 파일 삭제</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {isPaused ? (
        <View style={styles.downloadState}>
          <Text style={styles.downloadText}>
            일시정지 · {downloadState.bytesWritten.toLocaleString()} bytes
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              disabled={interactionDisabled || !memorySupported}
              style={[
                styles.installButton,
                (interactionDisabled || !memorySupported) && styles.disabled
              ]}
              onPress={props.onResume}
            >
              <Text style={styles.installButtonText}>이어받기</Text>
            </Pressable>
            <Pressable
              disabled={interactionDisabled}
              style={[styles.problemButton, interactionDisabled && styles.disabled]}
              onPress={props.onCancel}
            >
              <Text style={styles.problemButtonText}>부분 파일 삭제</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {downloadState?.kind === "verifying" ? (
        <Text style={styles.downloadText}>
          파일 크기와 SHA-256을 스트리밍 검증하고 있습니다.
        </Text>
      ) : null}

      {installation?.kind === "invalid" ? (
        <View style={styles.errorInline}>
          <Text style={styles.errorText}>
            설치 파일이 레지스트리와 일치하지 않아 실행을 차단했습니다.
          </Text>
          <Pressable
            disabled={interactionDisabled}
            style={[styles.problemButton, interactionDisabled && styles.disabled]}
            onPress={props.onDelete}
          >
            <Text style={styles.problemButtonText}>손상된 모델 삭제</Text>
          </Pressable>
        </View>
      ) : null}

      {installation?.kind === "ready" ? (
        <View style={styles.readyState}>
          <Text style={styles.readyText}>
            설치 및 무결성 확인 완료
            {activeSessionModelId === model.id ? " · 현재 불러옴" : ""}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              disabled={
                activeSessionModelId === model.id ||
                !memorySupported ||
                interactionDisabled
              }
              style={[
                styles.installButton,
                (activeSessionModelId === model.id ||
                  !memorySupported ||
                  interactionDisabled) &&
                  styles.disabled
              ]}
              onPress={() => props.onLoad(installation.installed)}
            >
              <Text style={styles.installButtonText}>모델 불러오기</Text>
            </Pressable>
            <Pressable
              disabled={interactionDisabled}
              style={[styles.problemButton, interactionDisabled && styles.disabled]}
              onPress={props.onDelete}
            >
              <Text style={styles.problemButtonText}>모델 삭제</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function errorMessage(kind: LocalAiErrorKind): string {
  switch (kind) {
    case "offline":
      return "모델 다운로드에 인터넷 연결이 필요합니다. 일반 생활 기능은 오프라인에서도 계속 사용할 수 있습니다.";
    case "storage":
      return "저장공간이 부족하거나 앱 전용 저장소를 열 수 없습니다. 공간을 정리한 뒤 다시 시도해 주세요.";
    case "integrity":
      return "모델 크기 또는 SHA-256이 고정 레지스트리와 일치하지 않아 실행을 차단했습니다.";
    case "unsupported":
      return "이 기기의 ABI는 지원하지 않습니다. arm64-v8a 또는 x86_64 Android가 필요합니다.";
    case "memory":
      return "확인 가능한 기기 RAM이 선택 모델의 최소 요구량보다 부족해 설치와 실행을 차단했습니다.";
    case "runtime":
      return "기기 내 모델 컨텍스트를 시작하거나 해제하지 못했습니다. 더 작은 모델을 사용하거나 앱을 다시 열어 주세요.";
    default:
      return "로컬 AI 상태를 확인하지 못했습니다. 모델을 삭제한 뒤 다시 설치할 수 있습니다.";
  }
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: {
    gap: 8,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#183138"
  },
  kicker: {
    color: "#cde0d7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  heading: { color: "#fffdf7", fontSize: 28, fontWeight: "800" },
  heroBody: { color: "#e7efeb", fontSize: 16, lineHeight: 24 },
  privacy: { color: "#bcd3c9", fontSize: 14, lineHeight: 21 },
  noticeCard: {
    gap: 6,
    padding: 17,
    borderRadius: 17,
    backgroundColor: "#e8f0e9"
  },
  noticeTitle: { color: "#243a3d", fontSize: 18, fontWeight: "800" },
  noticeText: { color: "#344d50", fontSize: 15, lineHeight: 22 },
  noticeSubtext: { color: "#5a6d70", fontSize: 14, lineHeight: 21 },
  section: {
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#fffdf7"
  },
  sectionTitle: { color: "#1a2626", fontSize: 21, fontWeight: "800" },
  sectionDescription: { color: "#526166", fontSize: 15, lineHeight: 22 },
  modelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  modelCard: {
    flexGrow: 1,
    flexBasis: 280,
    gap: 9,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cfdbd7",
    backgroundColor: "#f8f6ef"
  },
  modelHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modelProvider: { color: "#557067", fontSize: 12, fontWeight: "900" },
  badge: {
    color: "#fff",
    backgroundColor: "#6f8a70",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden"
  },
  modelName: { color: "#1f3033", fontSize: 18, fontWeight: "800" },
  modelDescription: { color: "#506064", fontSize: 14, lineHeight: 20 },
  modelMeta: { color: "#667477", fontSize: 13 },
  detailsButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#e3ebe8"
  },
  detailsButtonText: { color: "#25474a", fontWeight: "800" },
  blockedState: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#ece7de"
  },
  blockedText: { color: "#655f55", fontWeight: "700" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 26,
    height: 26,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#6f8a70",
    borderRadius: 7
  },
  checkboxChecked: { backgroundColor: "#6f8a70" },
  checkboxMark: { color: "#fff", fontWeight: "900" },
  consentText: { flex: 1, color: "#45575b", fontSize: 14, lineHeight: 20 },
  installButton: {
    minHeight: 48,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#183138"
  },
  installButtonText: { color: "#fff", fontWeight: "800" },
  downloadState: { gap: 8 },
  downloadText: { color: "#35575a", fontWeight: "700", lineHeight: 21 },
  readyState: { gap: 8 },
  readyText: { color: "#1f684d", fontWeight: "800" },
  errorInline: { gap: 8, padding: 10, borderRadius: 12, backgroundColor: "#fff0ed" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  actionCard: {
    flexGrow: 1,
    flexBasis: 190,
    gap: 4,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cad5d2",
    backgroundColor: "#f8f6ef"
  },
  actionCardSelected: { borderColor: "#6f8a70", backgroundColor: "#6f8a70" },
  actionLabel: { color: "#25383c", fontSize: 16, fontWeight: "800" },
  actionLabelSelected: { color: "#fff" },
  actionDescription: { color: "#647276", fontSize: 13, lineHeight: 19 },
  actionDescriptionSelected: { color: "#eef5f1" },
  input: {
    minHeight: 150,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#cbd5d4",
    padding: 14,
    backgroundColor: "#fff",
    color: "#1a2626",
    fontSize: 17,
    lineHeight: 24
  },
  policyText: { color: "#775b32", fontSize: 13, lineHeight: 20 },
  primaryButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#c4684f"
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cancelButton: {
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#8b4035"
  },
  cancelButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  previewCard: {
    gap: 12,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#eff5ef",
    borderWidth: 1,
    borderColor: "#b9cfbf"
  },
  previewWarning: { color: "#5f5336", fontSize: 14, lineHeight: 21 },
  previewText: {
    color: "#1f3033",
    fontSize: 17,
    lineHeight: 26,
    padding: 14,
    borderRadius: 13,
    backgroundColor: "#fff"
  },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  approveButton: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#2c6b4e"
  },
  approveButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#e4ebe8"
  },
  secondaryButtonText: { color: "#294448", fontWeight: "800" },
  problemButton: {
    minHeight: 48,
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f2dcd7"
  },
  problemButtonText: { color: "#7d342a", fontWeight: "800", textAlign: "center" },
  errorCard: {
    gap: 5,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff0ed",
    borderWidth: 1,
    borderColor: "#d58c80"
  },
  errorTitle: { color: "#7b3028", fontSize: 17, fontWeight: "800" },
  errorText: { color: "#70453f", fontSize: 14, lineHeight: 21 },
  screenMessage: {
    color: "#7b3028",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff0ed"
  },
  status: {
    color: "#3a4e54",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21
  },
  powered: {
    color: "#1f5f4b",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  disabled: { opacity: 0.48 }
});
