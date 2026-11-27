class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.lastLevelAt = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length) {
      const frame = input[0].slice();
      let sumSquares = 0;
      for (let index = 0; index < frame.length; index += 1) {
        sumSquares += frame[index] * frame[index];
      }

      const level = Math.sqrt(sumSquares / frame.length);
      this.port.postMessage({ type: "audio", frame }, [frame.buffer]);

      // Keep the UI meter responsive without flooding the main thread.
      if (currentTime - this.lastLevelAt >= 0.08) {
        this.lastLevelAt = currentTime;
        this.port.postMessage({ type: "level", level });
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
