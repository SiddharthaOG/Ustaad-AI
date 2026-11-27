"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { encodePcm16Wav, MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS, resampleMono } from "./wav";

export type AudioRecorderStatus = "idle" | "requesting" | "recording" | "processing" | "ready" | "error";

function getMicrophoneError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Microphone permission was denied. Allow microphone access or upload an audio clip.";
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") return "No microphone was found. Connect a microphone or upload an audio clip.";
    if (error.name === "NotReadableError") return "The microphone is busy in another app. Close that app and try again.";
  }
  return error instanceof Error ? error.message : "Could not record audio. Please try again.";
}

export function useAudioRecorder() {
  const [status, setStatus] = useState<AudioRecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const audioUrlRef = useRef("");
  const [error, setError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const framesRef = useRef<Float32Array[]>([]);
  const frameCountRef = useRef(0);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const recordingRef = useRef(false);
  const sampleRateRef = useRef(48_000);

  const releaseResources = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    workletRef.current?.port.close();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    sourceRef.current = null;
    workletRef.current = null;
    gainRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== "closed") await context.close().catch(() => undefined);
  }, []);

  const stop = useCallback(async () => {
    if (stoppingRef.current || !recordingRef.current) return;
    stoppingRef.current = true;
    recordingRef.current = false;
    setStatus("processing");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const sourceRate = sampleRateRef.current;
    await releaseResources();

    try {
      const merged = new Float32Array(frameCountRef.current);
      let offset = 0;
      for (const frame of framesRef.current) { merged.set(frame, offset); offset += frame.length; }
      const mono16k = resampleMono(merged, sourceRate);
      const duration = mono16k.length / 16_000;
      if (duration <= 0) throw new Error("No audio was captured. Please try again.");
      if (duration > MAX_RECORDING_SECONDS + 0.05) throw new Error("Recording exceeded the 15-second limit. Please try again.");
      const wav = encodePcm16Wav(mono16k);
      if (wav.size > MAX_AUDIO_BYTES) throw new Error("Recording is larger than 2 MB. Please record a shorter clip.");
      setAudioBlob(wav);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(wav);
      setAudioUrl(audioUrlRef.current);
      setSeconds(Math.min(MAX_RECORDING_SECONDS, Math.ceil(duration)));
      setError("");
      setStatus("ready");
    } catch (caught) {
      setError(getMicrophoneError(caught));
      setStatus("error");
    } finally {
      framesRef.current = [];
      frameCountRef.current = 0;
      stoppingRef.current = false;
      sampleRateRef.current = 48_000;
    }
  }, [releaseResources]);

  const start = useCallback(async () => {
    if (status === "requesting" || status === "recording" || status === "processing") return;
    setAudioBlob(null);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    setAudioUrl("");
    setError("");
    setSeconds(0);
    framesRef.current = [];
    frameCountRef.current = 0;
    stoppingRef.current = false;
    recordingRef.current = false;
    setStatus("requesting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone recording is not supported here. Use HTTPS or upload an audio clip.");
      if (!("AudioWorkletNode" in window)) throw new Error("This browser does not support the required audio capture feature. Please use a recent browser or upload an audio clip.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const context = new AudioContext();
      contextRef.current = context;
      await context.audioWorklet.addModule("/audio/pcm-capture-processor.js");
      await context.resume();
      sampleRateRef.current = context.sampleRate;
      const source = context.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(context, "pcm-capture-processor", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: "explicit", channelInterpretation: "speakers" });
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const frame = event.data;
        if (!(frame instanceof Float32Array) || !recordingRef.current) return;
        framesRef.current.push(frame);
        frameCountRef.current += frame.length;
        if (frameCountRef.current >= context.sampleRate * MAX_RECORDING_SECONDS) void stop();
      };
      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(context.destination);
      sourceRef.current = source;
      workletRef.current = worklet;
      gainRef.current = silentGain;
      startedAtRef.current = Date.now();
      recordingRef.current = true;
      setStatus("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(Math.min(elapsed, MAX_RECORDING_SECONDS));
        if (elapsed >= MAX_RECORDING_SECONDS) void stop();
      }, 200);
    } catch (caught) {
      await releaseResources();
      setError(getMicrophoneError(caught));
      setStatus("error");
    }
  }, [releaseResources, status, stop]);

  const clear = useCallback(() => {
    void releaseResources();
    recordingRef.current = false;
    framesRef.current = [];
    frameCountRef.current = 0;
    setAudioBlob(null);
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = "";
    setAudioUrl("");
    setSeconds(0);
    setError("");
    setStatus("idle");
  }, [releaseResources]);

  useEffect(() => () => { void releaseResources(); if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current); }, [releaseResources]);

  return { status, seconds, audioBlob, audioUrl, error, start, stop, clear };
}
