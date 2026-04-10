import * as Speech from "expo-speech";

export interface MobileSpeechController {
  capabilities: {
    canSpeak: boolean;
    canListen: boolean;
  };
  speak: (text: string) => void;
  cancel: () => void;
  startListening: (onTranscript: (text: string) => void) => void;
  stopListening: () => void;
}

export function createMobileSpeechController(): MobileSpeechController {
  return {
    capabilities: {
      canSpeak: true,
      canListen: false
    },
    speak(text) {
      Speech.speak(text, {
        language: "ko-KR"
      });
    },
    cancel() {
      Speech.stop();
    },
    startListening(onTranscript) {
      void onTranscript;
    },
    stopListening() {}
  };
}
