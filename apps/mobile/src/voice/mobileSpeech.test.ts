import { describe, expect, test } from "vitest";

import { createMobileSpeechController } from "./mobileSpeech";

describe("createMobileSpeechController", () => {
  test("keeps mobile speech output disabled by default for the private test", () => {
    const controller = createMobileSpeechController();

    expect(controller.capabilities).toEqual({ canSpeak: false, canListen: false });
    expect(() => controller.speak("민감할 수 있는 돌봄 문장")).not.toThrow();
  });
});
