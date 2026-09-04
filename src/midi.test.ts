import { describe, expect, it } from 'vitest'
import { NoteRecorder, parseMidiMessage } from './midi'

describe('parseMidiMessage', () => {
  it('reads note-on and note-off on any channel', () => {
    expect(parseMidiMessage([0x90, 60, 100], 5)).toEqual({ kind: 'noteon', midi: 60, velocity: 100, timeMs: 5 })
    expect(parseMidiMessage([0x83, 60, 0], 9)).toEqual({ kind: 'noteoff', midi: 60, timeMs: 9 })
  })

  it('treats note-on with velocity 0 as note-off', () => {
    expect(parseMidiMessage([0x90, 60, 0], 7)).toEqual({ kind: 'noteoff', midi: 60, timeMs: 7 })
  })

  it('reads the sustain pedal and ignores other controllers', () => {
    expect(parseMidiMessage([0xb0, 64, 127], 1)).toEqual({ kind: 'sustain', down: true, timeMs: 1 })
    expect(parseMidiMessage([0xb0, 64, 0], 2)).toEqual({ kind: 'sustain', down: false, timeMs: 2 })
    expect(parseMidiMessage([0xb0, 1, 50], 3)).toBeNull()
  })

  it('ignores short and unrelated messages', () => {
    expect(parseMidiMessage([0xfe], 0)).toBeNull() // active sensing
    expect(parseMidiMessage([0xe0, 0, 64], 0)).toBeNull() // pitch bend
  })
})

describe('NoteRecorder', () => {
  it('pairs note-on with note-off into a PlayedNote', () => {
    const recorder = new NoteRecorder()
    recorder.push({ kind: 'noteon', midi: 60, velocity: 80, timeMs: 100 })
    expect(recorder.activeNotes()).toEqual([{ midi: 60, startMs: 100, velocity: 80 }])
    recorder.push({ kind: 'noteoff', midi: 60, timeMs: 350 })
    expect(recorder.notes).toEqual([{ midi: 60, startMs: 100, durationMs: 250, velocity: 80 }])
    expect(recorder.activeNotes()).toEqual([])
  })

  it('makes times relative to the origin', () => {
    const recorder = new NoteRecorder(1000)
    recorder.push({ kind: 'noteon', midi: 62, velocity: 90, timeMs: 1200 })
    recorder.push({ kind: 'noteoff', midi: 62, timeMs: 1500 })
    expect(recorder.notes[0]).toMatchObject({ startMs: 200, durationMs: 300 })
  })

  it('ends a held note when the same key is struck again', () => {
    const recorder = new NoteRecorder()
    recorder.push({ kind: 'noteon', midi: 60, velocity: 80, timeMs: 0 })
    recorder.push({ kind: 'noteon', midi: 60, velocity: 70, timeMs: 400 })
    expect(recorder.notes).toEqual([{ midi: 60, startMs: 0, durationMs: 400, velocity: 80 }])
    expect(recorder.activeNotes()).toEqual([{ midi: 60, startMs: 400, velocity: 70 }])
  })

  it('ignores a note-off with no matching note-on', () => {
    const recorder = new NoteRecorder()
    recorder.push({ kind: 'noteoff', midi: 60, timeMs: 10 })
    expect(recorder.notes).toEqual([])
  })

  it('finish() closes every held note', () => {
    const recorder = new NoteRecorder()
    recorder.push({ kind: 'noteon', midi: 60, velocity: 80, timeMs: 0 })
    recorder.push({ kind: 'noteon', midi: 64, velocity: 80, timeMs: 10 })
    recorder.finish(500)
    expect(recorder.notes.map((n) => n.durationMs)).toEqual([500, 490])
  })

  it('tracks the sustain pedal without creating notes', () => {
    const recorder = new NoteRecorder()
    recorder.push({ kind: 'sustain', down: true, timeMs: 0 })
    expect(recorder.sustainDown).toBe(true)
    expect(recorder.notes).toEqual([])
  })
})
