export const PRIVACY_POLICY_URL =
  "https://sinmb79.github.io/careguardian-ai/privacy-policy.html";
export const HUGGING_FACE_PRIVACY_POLICY_URL = "https://huggingface.co/privacy";

const APPROVED_EXTERNAL_URLS = new Set<string>([
  PRIVACY_POLICY_URL,
  HUGGING_FACE_PRIVACY_POLICY_URL
]);

export type ExternalLinkOpener = (url: string) => Promise<unknown>;

export type ExternalLinkOpenResult =
  | { ok: true }
  | { ok: false; kind: "blocked" | "open-failed" };

/** Opens an exact, application-owned policy URL and never accepts user-provided hosts. */
export async function openApprovedExternalLink(
  url: string,
  opener: ExternalLinkOpener
): Promise<ExternalLinkOpenResult> {
  if (!APPROVED_EXTERNAL_URLS.has(url)) return { ok: false, kind: "blocked" };

  try {
    await opener(url);
    return { ok: true };
  } catch {
    return { ok: false, kind: "open-failed" };
  }
}
