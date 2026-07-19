import * as LocalAuthentication from "expo-local-authentication";

export interface AuthenticationResult {
  authenticated: boolean;
  message: string;
}

export async function authenticateForSensitiveAccess(): Promise<AuthenticationResult> {
  try {
    const supported = await LocalAuthentication.hasHardwareAsync();
    if (!supported) {
      return {
        authenticated: false,
        message: "이 기기에서는 화면 잠금을 확인할 수 없습니다. 안전을 위해 잠긴 상태를 유지합니다."
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "돌봄 정보 열기",
      cancelLabel: "취소",
      disableDeviceFallback: false
    });

    return result.success
      ? { authenticated: true, message: "인증되었습니다." }
      : { authenticated: false, message: "인증이 완료되지 않았습니다. 잠긴 상태를 유지합니다." };
  } catch {
    return {
      authenticated: false,
      message: "기기 인증을 확인하지 못했습니다. 안전을 위해 잠긴 상태를 유지합니다."
    };
  }
}
