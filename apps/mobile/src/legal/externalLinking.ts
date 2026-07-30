import { Linking } from "react-native";
import {
  HUGGING_FACE_PRIVACY_POLICY_URL,
  openApprovedExternalLink,
  PRIVACY_POLICY_URL,
  type ExternalLinkOpenResult
} from "./externalLinks";

export function openPrivacyPolicy(): Promise<ExternalLinkOpenResult> {
  return openApprovedExternalLink(PRIVACY_POLICY_URL, (url) => Linking.openURL(url));
}

export function openHuggingFacePrivacyPolicy(): Promise<ExternalLinkOpenResult> {
  return openApprovedExternalLink(HUGGING_FACE_PRIVACY_POLICY_URL, (url) =>
    Linking.openURL(url)
  );
}
