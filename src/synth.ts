// A small Web Audio instrument so the keyboard can be heard through the
// computer (headphones in the Mac) instead of its own speakers. Two
// oscillators per note with a piano-like envelope: quick attack, a decay
// that keeps fading while the key is held, a short release. Honours the
// sustain pedal. Not a piano sample, but enough to judge the latency and to
// practise with. Uses its own AudioContext with the lowest-latency hint.

import type { MidiEvent } from './midi'

const MASTER_GAIN = 0.5
const ATTACK_SEC = 0.005
const RELEASE_SEC = 0.2
const MAX_VOICE_GAIN = 0.35

interface Voice {
  oscillators: OscillatorNode[]
  gain: GainNode
}

export class Synth {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private voices = new Map<number, Voice>()
  private heldByPedal = new Set<number>() // keys released while the pedal is down
  private pedalDown = false

  // Call from a click so the browser lets the context start.
  enable(): void {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.master = this.context.createGain()
      this.master.gain.value = MASTER_GAIN
      this.master.connect(this.context.destination)
    }
    void this.context.resume()
  }

  // Key to ear, as far as the browser can tell: its own buffer plus the device's.
  latencyMs(): number | null {
    if (!this.context) return null
    return Math.round((this.context.baseLatency + this.context.outputLatency) * 1000)
  }

  handle(event: MidiEvent): void {
    if (event.kind === 'noteon') this.noteOn(event.midi, event.velocity)
    else if (event.kind === 'noteoff') this.noteOff(event.midi)
    else this.sustain(event.down)
  }

  allOff(): void {
    this.pedalDown = false
    this.heldByPedal.clear()
    for (const midi of [...this.voices.keys()]) this.release(midi)
  }

  private noteOn(midi: number, velocity: number): void {
    const context = this.context
    if (!context || !this.master) return
    if (this.voices.has(midi)) this.release(midi)
    this.heldByPedal.delete(midi)
    const now = context.currentTime
    const frequency = 440 * 2 ** ((midi - 69) / 12)
    const peak = MAX_VOICE_GAIN * (velocity / 127) ** 1.5
    const gain = context.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(peak, now + ATTACK_SEC)
    gain.gain.exponentialRampToValueAtTime(peak * 0.3, now + 0.6) // the initial bloom dies away
    gain.gain.exponentialRampToValueAtTime(peak * 0.03, now + 5) // then a long piano-like fade
    gain.connect(this.master)
    const fundamental = context.createOscillator()
    fundamental.type = 'triangle'
    fundamental.frequency.value = frequency
    const octave = context.createOscillator()
    octave.type = 'sine'
    octave.frequency.value = frequency * 2
    const octaveGain = context.createGain()
    octaveGain.gain.value = 0.25
    fundamental.connect(gain)
    octave.connect(octaveGain).connect(gain)
    fundamental.start(now)
    octave.start(now)
    this.voices.set(midi, { oscillators: [fundamental, octave], gain })
  }

  private noteOff(midi: number): void {
    if (this.pedalDown && this.voices.has(midi)) {
      this.heldByPedal.add(midi)
      return
    }
    this.release(midi)
  }

  private sustain(down: boolean): void {
    this.pedalDown = down
    if (down) return
    for (const midi of [...this.heldByPedal]) this.release(midi)
    this.heldByPedal.clear()
  }

  private release(midi: number): void {
    const voice = this.voices.get(midi)
    const context = this.context
    if (!voice || !context) return
    const now = context.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now)
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + RELEASE_SEC)
    for (const oscillator of voice.oscillators) oscillator.stop(now + RELEASE_SEC + 0.05)
    this.voices.delete(midi)
  }
}
