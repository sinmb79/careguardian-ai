import Storage from "expo-sqlite/kv-store";
import * as SecureStore from "expo-secure-store";
import type { CareManual } from "@careguardian/care-core/manual";

const MOBILE_MANUAL_KEY = "careguardian.mobile.manual";
const MOBILE_CONTEXT_KEY = "careguardian.mobile.context";

export interface MobileManualContext {
  subjectName: string;
  savedAt: string;
}

export async function saveMobileCareManual(manual: CareManual): Promise<void> {
  await Storage.setItem(MOBILE_MANUAL_KEY, JSON.stringify(manual));
  await SecureStore.setItemAsync(
    MOBILE_CONTEXT_KEY,
    JSON.stringify({
      subjectName: manual.subject.name,
      savedAt: manual.last_updated
    } satisfies MobileManualContext)
  );
}

export async function loadMobileCareManual(): Promise<CareManual | null> {
  const stored = await Storage.getItem(MOBILE_MANUAL_KEY);
  return stored ? (JSON.parse(stored) as CareManual) : null;
}

export async function loadMobileManualContext(): Promise<MobileManualContext | null> {
  const stored = await SecureStore.getItemAsync(MOBILE_CONTEXT_KEY);
  return stored ? (JSON.parse(stored) as MobileManualContext) : null;
}
