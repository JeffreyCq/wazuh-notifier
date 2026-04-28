export function playNotificationBeep(): void {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    gain.connect(ctx.destination);

    // Two ascending tones
    const tones = [680, 1020];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.11);
    });

    // Auto-close context after sound finishes
    setTimeout(() => ctx.close(), 600);
  } catch {
    // AudioContext unavailable in this context
  }
}
