let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext()
  return _ctx
}

export function playPlace(pitchVariance = true) {
  const ctx = getCtx()
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
  const data = buf.getChannelData(0)
  const decay = ctx.sampleRate * 0.007 * (pitchVariance ? 0.9 + Math.random() * 0.2 : 1)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / decay)
  }
  const src = ctx.createBufferSource()
  const gain = ctx.createGain()
  gain.gain.value = 0.16
  src.buffer = buf
  src.connect(gain)
  gain.connect(ctx.destination)
  src.start()
}

export function playLockIn() {
  const ctx = getCtx()
  ;[660, 880].forEach((f, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = f
    const t = ctx.currentTime + i * 0.06
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  })
}

export function playError() {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(180, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15)
  gain.gain.setValueAtTime(0.18, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.16)
}

export function playWinFanfare() {
  const ctx = getCtx()
  // C E G C E in triangle wave
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = f
    const t = ctx.currentTime + i * 0.09
    gain.gain.setValueAtTime(0.001, t)
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.42)
  })
}
