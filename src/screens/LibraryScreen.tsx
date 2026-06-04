import { useState } from 'react'
import type { Puzzle } from '../types'
import { generatePuzzle } from '../lib/generator'

interface Props {
  puzzles: Puzzle[]
  onPlay: (puzzle: Puzzle) => void
  onEdit: () => void
  onSaveGenerated: (puzzle: Puzzle) => void
  onDelete: (id: string) => void
}

type Filter = 'all' | Puzzle['diff']

const DIFFS: Puzzle['diff'][] = ['easy', 'medium', 'hard']

export function LibraryScreen({ puzzles, onPlay, onEdit, onSaveGenerated, onDelete }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const visible = filter === 'all' ? puzzles : puzzles.filter(p => p.diff === filter)

  function handleGenerate(diff: Puzzle['diff']) {
    onSaveGenerated(generatePuzzle(diff))
  }

  return (
    <div className="library-screen">
      <header className="library-screen__header">
        <h1>Puzzikub</h1>
        <button onClick={onEdit}>+ New Puzzle</button>
      </header>

      <div className="library-screen__generate">
        <span>Generate:</span>
        {DIFFS.map(d => (
          <button key={d} onClick={() => handleGenerate(d)}>
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <div className="library-screen__filters">
        {(['all', ...DIFFS] as Filter[]).map(f => (
          <button
            key={f}
            className={`pill${filter === f ? ' pill--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <ul className="library-screen__list">
        {visible.length === 0 && (
          <li className="library-screen__empty">No puzzles found.</li>
        )}
        {visible.map(p => (
          <li key={p.id} className="library-card">
            <div className="library-card__info">
              <strong>{p.name}</strong>
              <span className={`diff-badge diff-badge--${p.diff}`}>{p.diff}</span>
              {p.generated && <span className="generated-badge">auto</span>}
            </div>
            <div className="library-card__actions">
              <button onClick={() => onPlay(p)}>Play</button>
              <button className="btn-delete" onClick={() => onDelete(p.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
