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

export interface MobileSpeechAdapter {
  speak: (text: string) => void;
  stop: () => void;
}

export function createMobileSpeechController(
  adapter?: MobileSpeechAdapter
): MobileSpeechController {
  return {
    capabilities: {
      canSpeak: Boolean(adapter),
      canListen: false
    },
    speak(text) {
      adapter?.speak(text);
    },
    cancel() {
      adapter?.stop();
    },
    startListening(onTranscript) {
      void onTranscript;
    },
    stopListening() {}
  };
}
