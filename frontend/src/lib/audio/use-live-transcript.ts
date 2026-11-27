"use client";

import { useCallback, useRef, useState } from "react";

type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };

export function useLiveTranscript() {
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const [transcriptError, setTranscriptError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback((language: "hi-IN" | "en-IN" = "hi-IN") => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setSupported(false); return; }
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result?.[0]) continue;
        if (result.isFinal) finalText += `${result[0].transcript.trim()} `;
        else interimText += `${result[0].transcript.trim()} `;
      }
      if (finalText) setTranscript((current) => `${current} ${finalText}`.trim());
      setInterim(interimText.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setTranscriptError("Live transcription paused. You can still edit the text yourself.");
    };
    recognition.onend = () => { setInterim(""); if (recognitionRef.current === recognition) recognitionRef.current = null; };
    recognitionRef.current = recognition;
    setSupported(true);
    setTranscriptError("");
    try { recognition.start(); } catch { setTranscriptError("Live transcription could not start. You can type the description instead."); }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterim("");
  }, []);

  const clear = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setTranscript("");
    setInterim("");
    setTranscriptError("");
  }, []);

  return { transcript, setTranscript, interim, supported, transcriptError, start, stop, clear };
}
