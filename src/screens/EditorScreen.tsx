import { useState } from 'react'
import type { Tile, TileSpec, Puzzle, Screen } from '../types'
import { NUM_COLOR, TILE_COPIES } from '../types'
import { useEditor } from '../hooks/useEditor'
import { NavBar } from '../components/NavBar'
import { TilePicker } from '../components/TilePicker'

interface Props {
  onSave: (puzzle: Puzzle) => void
  onBack: () => void
  activeScreen: Screen
  onNav: (s: Screen) => void
  onShowTutorial: () => void
  onShowSettings: () => void
}

interface PickerState {
  position: { x: number; y: number }
  initialTile?: Tile
  onConfirm: (spec: TileSpec) => void
}

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

const circleXStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.15)',
  color: '#fff',
  fontSize: 10,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
  flexShrink: 0,
}

export function EditorScreen({ onSave, activeScreen, onNav, onShowTutorial, onShowSettings }: Props) {
  const {
    grid, rack, name, diff,
    setName, setDiff,
    setTileAt, clearTileAt,
    addRackTile, updateRackTile, removeRackTile,
    addRow, addCol, removeRow, removeCol,
    rowHasTiles, colHasTiles,
    buildPuzzle, reset,
  } = useEditor()

  const [picker, setPicker] = useState<PickerState | null>(null)
  const [saveError, setSaveError] = useState('')

  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const gridH = rows * 64 - 6  // rows * (58 + 6) - 6

  // m=2 Step 8: the editor mutators can now REFUSE (a third copy of a
  // (value,colour) would make the puzzle unsolvable by construction). Route every
  // one through here so a refusal is shown rather than silently swallowed.
  function apply(ok: boolean) {
    setSaveError(ok ? '' : `Only ${TILE_COPIES} copies of any tile are allowed.`)
  }

  function openPicker(e: React.MouseEvent, initialTile: Tile | undefined, onConfirm: (spec: TileSpec) => void) {
    e.stopPropagation()
    setPicker({ position: { x: e.clientX, y: e.clientY }, initialTile, onConfirm })
  }

  function confirmRemoveRow(ri: number) {
    if (rows <= 1) return
    if (rowHasTiles(ri)) {
      if (!window.confirm('This row has tiles — remove anyway?')) return
    }
    removeRow(ri)
  }

  function confirmRemoveCol(ci: number) {
    if (cols <= 1) return
    if (colHasTiles(ci)) {
      if (!window.confirm('This column has tiles — remove anyway?')) return
    }
    removeCol(ci)
  }

  function handleSave() {
    const puzzle = buildPuzzle()
    if (!puzzle) {
      setSaveError('Add a name and at least one rack tile')
      return
    }
    setSaveError('')
    onSave(puzzle)
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
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Name</div>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setSaveError('') }}
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

        {/* ── Grid ── */}
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>grid</div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          {/* Left column: row × buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Spacer aligning with col-× buttons row */}
            <div style={{ height: 22 }} />
            {grid.map((_, ri) => (
              <div key={ri} style={{ height: 58, display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => confirmRemoveRow(ri)}
                  disabled={rows <= 1}
                  style={{ ...circleXStyle, opacity: rows <= 1 ? 0.3 : 1 }}
                >×</button>
              </div>
            ))}
          </div>

          {/* Center: col controls + grid + add-row */}
          <div>
            {/* Col × buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 46px)`,
              gap: 6,
              marginBottom: 4,
            }}>
              {Array.from({ length: cols }, (_, ci) => (
                <div key={ci} style={{ display: 'flex', justifyContent: 'center', height: 18 }}>
                  <button
                    onClick={() => confirmRemoveCol(ci)}
                    disabled={cols <= 1}
                    style={{ ...circleXStyle, opacity: cols <= 1 ? 0.3 : 1 }}
                  >×</button>
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div style={{
              display: 'inline-grid',
              gridTemplateColumns: `repeat(${cols}, 46px)`,
              gridTemplateRows: `repeat(${rows}, 58px)`,
              gap: 6,
              background: 'var(--grid-bg)',
              borderRadius: 12,
              padding: 10,
            }}>
              {grid.map((row, ri) =>
                row.map((tile, ci) => {
                  if (tile) {
                    return (
                      <div
                        key={`${ri}-${ci}`}
                        onClick={e => openPicker(e, tile, t => { apply(setTileAt(ri, ci, t)); setPicker(null) })}
                        style={{
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
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        {tile.n}
                        <button
                          onClick={e => { e.stopPropagation(); clearTileAt(ri, ci) }}
                          style={{ ...circleXStyle, position: 'absolute', top: 3, right: 3 }}
                        >×</button>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={`${ri}-${ci}`}
                      onClick={e => openPicker(e, undefined, t => { apply(setTileAt(ri, ci, t)); setPicker(null) })}
                      style={{
                        width: 46,
                        height: 58,
                        borderRadius: 8,
                        border: '1.5px dashed var(--border)',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    />
                  )
                })
              )}
            </div>

            {/* Add row affordance */}
            <div
              onClick={addRow}
              style={{
                marginTop: 6,
                height: 22,
                border: '1.5px dashed var(--border)',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--text-secondary)',
                userSelect: 'none',
              }}
            >+ add row</div>
          </div>

          {/* Right: add column affordance */}
          <div
            onClick={addCol}
            style={{
              width: 22,
              height: gridH,
              border: '1.5px dashed var(--border)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text-secondary)',
              userSelect: 'none',
              marginTop: 26,  /* align with grid top (22px col-x row + 4px gap) */
            }}
          >+</div>
        </div>

        {/* ── Rack ── */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>rack</div>
          <div style={{
            background: 'var(--rack-bg)',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            minHeight: 70,
          }}>
            {rack.map((tile, i) => (
              <div
                key={i}
                onClick={e => openPicker(e, tile, t => { apply(updateRackTile(i, t)); setPicker(null) })}
                style={{
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
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {tile.n}
                <button
                  onClick={e => { e.stopPropagation(); removeRackTile(i) }}
                  style={{ ...circleXStyle, position: 'absolute', top: 3, right: 3 }}
                >×</button>
              </div>
            ))}

            {/* + add tile */}
            <div
              onClick={e => openPicker(e, undefined, t => { apply(addRackTile(t)); setPicker(null) })}
              style={{
                width: 46,
                height: 58,
                borderRadius: 8,
                border: '1.5px dashed var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                boxSizing: 'border-box',
              }}
            >+</div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 20, marginBottom: 32 }}>
          <button style={smallBtnStyle} onClick={reset}>Reset</button>
          <button
            onClick={handleSave}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              background: 'var(--text-primary)',
              color: 'var(--bg)',
              cursor: 'pointer',
            }}
          >Save Puzzle</button>
          {saveError && (
            <span style={{ fontSize: 12, color: '#A32D2D' }}>{saveError}</span>
          )}
        </div>

      </div>

      {picker && (
        <TilePicker
          initialTile={picker.initialTile}
          position={picker.position}
          onConfirm={picker.onConfirm}
          onCancel={() => setPicker(null)}
        />
      )}
    </div>
  )
}
