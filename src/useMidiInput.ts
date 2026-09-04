// Web MIDI access: asks permission, lists inputs, remembers the chosen one,
// and feeds its messages into a NoteRecorder.

import { useEffect, useState } from 'react'
import { NoteRecorder, parseMidiMessage } from './midi'
import { loadMidiInputId, saveMidiInputId } from './storage'

export type MidiStatus = 'unsupported' | 'requesting' | 'denied' | 'ready'

export interface MidiInputState {
  status: MidiStatus
  inputs: { id: string; name: string }[]
  selectedId: string | null
  selectInput: (id: string) => void
  lastNoteAtMs: number | null // performance.now() of the most recent note-on
  recorder: NoteRecorder
}

export function useMidiInput(): MidiInputState {
  const [status, setStatus] = useState<MidiStatus>('requesting')
  const [access, setAccess] = useState<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<{ id: string; name: string }[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(loadMidiInputId)
  const [lastNoteAtMs, setLastNoteAtMs] = useState<number | null>(null)
  // One recorder for the life of the hook; the piano roll reads it directly
  // every frame rather than through React state, since notes arrive often.
  const [recorder] = useState(() => new NoteRecorder())

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported')
      return
    }
    let cancelled = false
    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        if (cancelled) return
        setAccess(midiAccess)
        setStatus('ready')
        const refreshInputs = () =>
          setInputs([...midiAccess.inputs.values()].map((input) => ({ id: input.id, name: input.name ?? input.id })))
        refreshInputs()
        // Fires when a keyboard is plugged in or unplugged.
        midiAccess.onstatechange = refreshInputs
      })
      .catch(() => {
        if (!cancelled) setStatus('denied')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fall back to the first input when the remembered one isn't connected.
  const activeId = inputs.some((input) => input.id === selectedId) ? selectedId : (inputs[0]?.id ?? null)

  useEffect(() => {
    if (!access || !activeId) return
    const input = access.inputs.get(activeId)
    if (!input) return
    input.onmidimessage = (message) => {
      if (!message.data) return
      const event = parseMidiMessage(message.data, message.timeStamp)
      if (!event) return
      recorder.push(event)
      if (event.kind === 'noteon') setLastNoteAtMs(event.timeMs)
    }
    return () => {
      input.onmidimessage = null
    }
  }, [access, activeId, recorder])

  const selectInput = (id: string) => {
    setSelectedId(id)
    saveMidiInputId(id)
  }

  return { status, inputs, selectedId: activeId, selectInput, lastNoteAtMs, recorder }
}
