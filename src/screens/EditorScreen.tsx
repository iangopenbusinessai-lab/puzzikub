import { useState } from 'react'
import type { Tile, Puzzle } from '../types'
import { useEditor } from '../hooks/useEditor'

interface Props {
  onSave: (puzzle: Puzzle) => void
  onBack: () => void
}

const COLORS: { value: Tile['c']; label: string }[] = [
  { value: 'r', label: 'Red' },
  { value: 'b', label: 'Blue' },
  { value: 'a', label: 'Orange' },
  { value: 'k', label: 'Black' },
]

const COLOR_CLASS: Record<Tile['c'], string> = {
  r: 'tile--red', b: 'tile--blue', a: 'tile--orange', k: 'tile--black',
}

export function EditorScreen({ onSave, onBack }: Props) {
  const {
    editorSets, editorRack,
    name, diff, hint,
    setName, setDiff, setHint,
    addSet, removeSet, addSlot, removeSlot,
    addTileToRack, removeTileFromRack,
    isValid, buildPuzzle, reset,
  } = useEditor()

  const [pickerN, setPickerN] = useState(1)
  const [pickerC, setPickerC] = useState<Tile['c']>('r')

  return (
    <div className="editor-screen">
      <header className="editor-screen__header">
        <button className="btn-back" onClick={onBack}>← Library</button>
        <h1>Puzzle Editor</h1>
      </header>

      <section className="editor-screen__meta">
        <label className="editor-label">
          Name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Puzzle name" />
        </label>
        <label className="editor-label">
          Difficulty
          <select value={diff} onChange={e => setDiff(e.target.value as Puzzle['diff'])}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="editor-label">
          Hint
          <input value={hint} onChange={e => setHint(e.target.value)} placeholder="Optional hint" />
        </label>
      </section>

      <section className="editor-screen__sets">
        <h2>Sets</h2>
        {editorSets.map((row, setIdx) => (
          <div key={setIdx} className="editor-set">
            <span>Set {setIdx + 1} &mdash; {row.length} slots</span>
            <button onClick={() => addSlot(setIdx)}>+ slot</button>
            <button onClick={() => removeSlot(setIdx)} disabled={row.length <= 3}>− slot</button>
            <button onClick={() => removeSet(setIdx)} disabled={editorSets.length <= 1}>Remove</button>
          </div>
        ))}
        <button className="btn-add-set" onClick={addSet}>+ Add Set</button>
      </section>

      <section className="editor-screen__rack-builder">
        <h2>Rack tiles</h2>
        <div className="editor-screen__picker">
          <input
            type="number" min={1} max={13} value={pickerN}
            onChange={e => setPickerN(Math.max(1, Math.min(13, Number(e.target.value))))}
          />
          <select value={pickerC} onChange={e => setPickerC(e.target.value as Tile['c'])}>
            {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={() => addTileToRack({ n: pickerN, c: pickerC })}>Add</button>
        </div>
        <div className="editor-screen__rack-tiles">
          {editorRack.map((tile, i) => (
            <span key={i} className={`tile ${COLOR_CLASS[tile.c]}`}>
              {tile.n}
              <button className="tile__remove" onClick={() => removeTileFromRack(i)}>×</button>
            </span>
          ))}
        </div>
      </section>

      <div className="editor-screen__actions">
        <button onClick={reset}>Reset</button>
        <button onClick={() => onSave(buildPuzzle())} disabled={!isValid}>Save Puzzle</button>
      </div>
    </div>
  )
}
