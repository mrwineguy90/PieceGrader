// All persistence goes through here so the localStorage schema lives in one file.
//
// Schema:
//   "piece-grader:midiInputId" -> string, id of the MIDI input the user picked

const MIDI_INPUT_KEY = 'piece-grader:midiInputId'

export function loadMidiInputId(): string | null {
  return localStorage.getItem(MIDI_INPUT_KEY)
}

export function saveMidiInputId(id: string): void {
  localStorage.setItem(MIDI_INPUT_KEY, id)
}
