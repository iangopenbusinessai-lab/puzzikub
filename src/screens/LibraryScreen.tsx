import { useState, type CSSProperties } from 'react'
import type { Puzzle, Screen } from '../types'
import { generatePuzzle } from '../lib/generator'
import { NavBar } from '../components/NavBar'

interface Props {
  puzzles: Puzzle[]
  onPlay: (puzzle: Puzzle) => void
  onEdit: () => void
  onSaveGenerated: (puzzle: Puzzle) => void
  onDelete: (id: string) => void
  activeScreen: Screen
  onNav: (s: Screen) => void
  onShowTutorial: () => void
  onShowSettings: () => void
}

type Filter = 'all' | Puzzle['diff']

const DIFFS: Puzzle['diff'][] = ['easy', 'medium', 'hard', 'extreme']

const DIFF_BADGE: Record<Puzzle['diff'], CSSProperties> = {
  easy:    { background: '#EAF3DE', color: '#27500A' },
  medium:  { background: '#FAEEDA', color: '#633806' },
  hard:    { background: '#FCEBEB', color: '#791F1F' },
  extreme: { background: '#F0E6FF', color: '#4A1080' },
}

const badgeBase: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 20,
  display: 'inline-block',
}

export function LibraryScreen({ puzzles, onPlay, onEdit, onSaveGenerated, onDelete, activeScreen, onNav, onShowTutorial, onShowSettings }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const visible = filter === 'all' ? puzzles : puzzles.filter(p => p.diff === filter)

  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    border: '0.5px solid #ddd',
    borderRadius: 8,
    marginBottom: 6,
  }

  const genRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  }

  const filterRowStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
    marginBottom: 16,
  }

  function pillStyle(active: boolean): CSSProperties {
    return {
      borderRadius: 20,
      fontSize: 12,
      padding: '4px 14px',
      border: active ? '1px solid #85B7EB' : '1px solid #ddd',
      background: active ? '#E6F1FB' : 'transparent',
      color: active ? '#0C447C' : '#555',
      cursor: 'pointer',
      fontWeight: active ? 500 : 400,
    }
  }

  function smallBtn(danger?: boolean): CSSProperties {
    return {
      fontSize: 12,
      padding: '4px 10px',
      borderRadius: 6,
      border: '0.5px solid #ddd',
      background: danger ? '#fff5f5' : '#fff',
      color: danger ? '#791F1F' : '#333',
      cursor: 'pointer',
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingTop: 16 }}>
          <span style={{ fontSize: 11, color: '#999' }}>Saved puzzles</span>
          <button style={smallBtn()} onClick={onEdit}>+ New Puzzle</button>
        </div>

        <div style={genRowStyle}>
          <span style={{ fontSize: 11, color: '#999' }}>Generate:</span>
          {DIFFS.map(d => (
            <button key={d} style={smallBtn()} onClick={() => { const p = generatePuzzle(d); if (p) onSaveGenerated(p) }}>
              {d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        <div style={filterRowStyle}>
          {(['all', ...DIFFS] as Filter[]).map(f => (
            <button key={f} style={pillStyle(filter === f)} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div style={{ fontSize: 13, color: '#aaa', padding: '12px 0' }}>No puzzles found.</div>
        )}

        {visible.map(p => (
          <div key={p.id} style={rowStyle}>
            <span style={{ ...badgeBase, ...DIFF_BADGE[p.diff] }}>{p.diff}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</span>
            {p.generated && (
              <span style={{ fontSize: 10, color: '#aaa' }}>auto</span>
            )}
            <button style={smallBtn()} onClick={() => onPlay(p)}>Play</button>
            <button style={smallBtn(true)} onClick={() => onDelete(p.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
