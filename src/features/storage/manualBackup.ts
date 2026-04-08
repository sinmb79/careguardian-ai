import type { CareManual } from "../manual/manualSchema";
import { decryptJson, encryptJson } from "./secureLocalStore";

export async function serializeManualBackup(
  manual: CareManual,
  passphrase: string
): Promise<string> {
  const payload = await encryptJson(manual, passphrase);
  return JSON.stringify(payload, null, 2);
}

export async function parseManualBackup(
  serializedBackup: string,
  passphrase: string
): Promise<CareManual> {
  return decryptJson<CareManual>(JSON.parse(serializedBackup), passphrase);
}
