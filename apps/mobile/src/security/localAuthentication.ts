import * as LocalAuthentication from "expo-local-authentication";

export interface AuthenticationResult {
  authenticated: boolean;
  message: string;
}

export async function authenticateForSensitiveAccess(): Promise<AuthenticationResult> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) {
      return { authenticated: false, message: "이 기기에서는 개인 작업공간 잠금을 확인할 수 없습니다. 안전을 위해 잠금 상태를 유지합니다." };
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "개인 작업공간 열기",
      cancelLabel: "취소",
      disableDeviceFallback: false
    });
    return result.success
      ? { authenticated: true, message: "인증했습니다." }
      : { authenticated: false, message: "인증을 완료하지 못했습니다. 안전을 위해 잠금 상태를 유지합니다." };
  } catch {
    return { authenticated: false, message: "기기 인증을 확인하지 못했습니다. 안전을 위해 잠금 상태를 유지합니다." };
  }
}
