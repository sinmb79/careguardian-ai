import { describe, expect, test, vi } from "vitest";
import { createWebSpeechController } from "./webSpeech";

describe("createWebSpeechController", () => {
  test("reports capabilities based on the browser environment", () => {
    const controller = createWebSpeechController({
      synth: { speak: vi.fn(), cancel: vi.fn() } as unknown as SpeechSynthesis
    });

    expect(controller.capabilities.canSpeak).toBe(true);
    expect(controller.capabilities.canListen).toBe(false);
  });

  test("speaks text through the provided synth", () => {
    const speak = vi.fn();
    const controller = createWebSpeechController({
      synth: { speak, cancel: vi.fn() } as unknown as SpeechSynthesis,
      utteranceFactory: (text) => ({ text }) as SpeechSynthesisUtterance
    });

    controller.speak("안녕하세요");

    expect(speak).toHaveBeenCalledTimes(1);
  });

  test("starts listening and returns a transcript through the callback", () => {
    let onresult:
      | ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
      | null
      | undefined;
    const start = vi.fn(() => {
      onresult?.({
        results: [[{ transcript: "산책 가자" }]]
      });
    });

    const controller = createWebSpeechController({
      recognitionFactory: () => ({
        lang: "ko-KR",
        interimResults: false,
        start,
        stop: vi.fn(),
        set onresult(handler) {
          onresult = handler;
        },
        get onresult() {
          return onresult ?? null;
        }
      })
    });

    const transcript = vi.fn();
    controller.startListening(transcript);

    expect(start).toHaveBeenCalledTimes(1);
    expect(transcript).toHaveBeenCalledWith("산책 가자");
  });

  test("keeps browser speech recognition disabled by default", () => {
    const start = vi.fn();
    const Recognition = class {
      lang = "";
      interimResults = false;
      start = start;
      stop = vi.fn();
      onresult = null;
    };
    const recognitionWindow = window as Window & { SpeechRecognition?: unknown };
    const original = recognitionWindow.SpeechRecognition;
    Object.defineProperty(recognitionWindow, "SpeechRecognition", {
      configurable: true,
      value: Recognition
    });

    try {
      const controller = createWebSpeechController();
      controller.startListening(vi.fn());

      expect(controller.capabilities.canListen).toBe(false);
      expect(start).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(recognitionWindow, "SpeechRecognition", {
        configurable: true,
        value: original
      });
    }
  });
});
