export interface WebSpeechEnvironment {
  synth?: SpeechSynthesis;
  utteranceFactory?: (text: string) => SpeechSynthesisUtterance | { text: string };
  recognitionFactory?: () =>
    | {
    lang: string;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult?: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  }
    | undefined;
}

export interface WebSpeechController {
  capabilities: {
    canSpeak: boolean;
    canListen: boolean;
  };
  speak: (text: string) => void;
  cancel: () => void;
  startListening: (onTranscript: (text: string) => void) => void;
  stopListening: () => void;
}

export function createWebSpeechController(
  environment: WebSpeechEnvironment = {
    synth: typeof window !== "undefined" ? window.speechSynthesis : undefined,
    utteranceFactory:
      typeof window !== "undefined" && "SpeechSynthesisUtterance" in window
        ? (text) => new SpeechSynthesisUtterance(text)
        : undefined,
  }
): WebSpeechController {
  const synth = environment.synth;
  let recognitionInstance:
    | ReturnType<NonNullable<WebSpeechEnvironment["recognitionFactory"]>>
    | undefined;

  return {
    capabilities: {
      canSpeak: Boolean(synth),
      canListen: Boolean(environment.recognitionFactory?.())
    },
    speak(text: string) {
      if (!synth) {
        return;
      }

      const utterance = environment.utteranceFactory
        ? environment.utteranceFactory(text)
        : ({ text } as { text: string });

      synth.speak(utterance as SpeechSynthesisUtterance);
    },
    cancel() {
      synth?.cancel();
    }
    ,
    startListening(onTranscript) {
      if (!environment.recognitionFactory) {
        return;
      }

      recognitionInstance = environment.recognitionFactory();
      if (!recognitionInstance) {
        return;
      }
      recognitionInstance.lang = "ko-KR";
      recognitionInstance.interimResults = false;
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) {
          onTranscript(transcript);
        }
      };
      recognitionInstance.start();
    },
    stopListening() {
      recognitionInstance?.stop();
    }
  };
}
