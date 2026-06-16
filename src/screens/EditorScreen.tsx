import { useState } from 'react'
import type { Tile, Puzzle, Screen } from '../types'
import { NUM_COLOR } from '../types'
import { useEditor } from '../hooks/useEditor'
import { NavBar } from '../components/NavBar'

interface Props {
  onSave: (puzzle: Puzzle) => void
  onBack: () => void
  activeScreen: Screen
  onNav: (s: Screen) => void
  onShowTutorial: () => void
  onShowSettings: () => void
}

const COLORS: { value: Tile['c']; label: string }[] = [
  { value: 'r', label: 'Red' },
  { value: 'b', label: 'Blue' },
  { value: 'a', label: 'Orange' },
  { value: 'k', label: 'Black' },
]

export function EditorScreen({ onSave, activeScreen, onNav, onShowTutorial, onShowSettings }: Props) {
  const {
    editorSets, editorRack,
    name, diff,
    setName, setDiff,
    addSet, removeSet, addSlot, removeSlot,
    addTileToRack, removeTileFromRack,
    isValid, buildPuzzle, reset,
  } = useEditor()

  const [pickerN, setPickerN] = useState(1)
  const [pickerC, setPickerC] = useState<Tile['c']>('r')

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '0.5px solid var(--border)',
    fontSize: 13,
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    width: '100%',
    boxSizing: 'border-box',
  }

  const smallBtnStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    border: '0.5px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', transition: 'background 0.15s ease' }}>
      <NavBar
        activeScreen={activeScreen}
        onNav={onNav}
        onShowTutorial={onShowTutorial}
        onShowSettings={onShowSettings}
      />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 0' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Puzzle Editor</span>
        </div>

        {/* Name + Difficulty */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Name</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Puzzle name"
              style={inputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Difficulty</div>
            <select
              value={diff}
              onChange={e => setDiff(e.target.value as Puzzle['diff'])}
              style={{ ...inputStyle, width: 'auto' }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Sets */}
        <div style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Sets</div>
        {editorSets.map((row, setIdx) => (
          <div key={setIdx} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 0', borderBottom: '0.5px solid var(--border)',
          }}>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
              Set {setIdx + 1} &mdash; {row.length} slots
            </span>
            <button style={smallBtnStyle} onClick={() => addSlot(setIdx)}>+ slot</button>
            <button style={smallBtnStyle} onClick={() => removeSlot(setIdx)} disabled={row.length <= 3}>− slot</button>
            <button
              style={{ ...smallBtnStyle, color: '#791F1F' }}
              onClick={() => removeSet(setIdx)}
              disabled={editorSets.length <= 1}
            >Remove</button>
          </div>
        ))}
        <button style={{ ...smallBtnStyle, marginTop: 10 }} onClick={addSet}>+ Add Set</button>

        {/* Rack tiles */}
        <div style={{ marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Rack tiles</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="number" min={1} max={13} value={pickerN}
            onChange={e => setPickerN(Math.max(1, Math.min(13, Number(e.target.value))))}
            style={{ ...inputStyle, width: 72 }}
          />
          <select
            value={pickerC}
            onChange={e => setPickerC(e.target.value as Tile['c'])}
            style={{ ...inputStyle, width: 'auto' }}
          >
            {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button style={smallBtnStyle} onClick={() => addTileToRack({ n: pickerN, c: pickerC })}>Add</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {editorRack.map((tile, i) => (
            <div key={i} style={{
              position: 'relative',
              width: 46,
              height: 58,
              borderRadius: 8,
              background: 'var(--tile-bg)',
              boxShadow: 'var(--tile-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 500,
              color: NUM_COLOR[tile.c],
              userSelect: 'none',
            }}>
              {tile.n}
              <button
                onClick={() => removeTileFromRack(i)}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0,0,0,0.18)',
                  color: '#fff',
                  fontSize: 10,
                  lineHeight: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >×</button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 32 }}>
          <button style={smallBtnStyle} onClick={reset}>Reset</button>
          <button
            onClick={() => onSave(buildPuzzle())}
            disabled={!isValid}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              background: isValid ? 'var(--text-primary)' : 'var(--border)',
              color: isValid ? 'var(--bg)' : 'var(--text-secondary)',
              cursor: isValid ? 'pointer' : 'default',
            }}
          >Save Puzzle</button>
        </div>

      </div>
    </div>
  )
}
