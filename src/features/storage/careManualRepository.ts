import type { CareManual } from "../manual/manualSchema";
import { decryptJson, encryptJson } from "./secureLocalStore";

export const CARE_MANUAL_STORAGE_KEY = "careguardian.manual";

export async function saveCareManual(
  manual: CareManual,
  passphrase: string,
  storage: Storage = localStorage
): Promise<void> {
  const encrypted = await encryptJson(manual, passphrase);
  storage.setItem(CARE_MANUAL_STORAGE_KEY, JSON.stringify(encrypted));
}

export async function loadCareManual(
  passphrase: string,
  storage: Storage = localStorage
): Promise<CareManual | null> {
  const storedValue = storage.getItem(CARE_MANUAL_STORAGE_KEY);

  if (!storedValue) {
    return null;
  }

  return decryptJson<CareManual>(JSON.parse(storedValue), passphrase);
}
