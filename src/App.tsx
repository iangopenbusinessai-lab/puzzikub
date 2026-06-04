import { useState, type CSSProperties } from 'react'
import type { Puzzle } from './types'
import { loadLibrary, saveLibrary } from './lib/storage'
import { generatePuzzle } from './lib/generator'
import { LibraryScreen } from './screens/LibraryScreen'
import { PlayScreen } from './screens/PlayScreen'
import { EditorScreen } from './screens/EditorScreen'

type Screen = 'play' | 'library' | 'editor'

const NAV_LABELS: Record<Screen, string> = { play: 'Play', library: 'Library', editor: 'Editor' }
const NAV_ORDER: Screen[] = ['play', 'library', 'editor']

function App() {
  const [screen, setScreen] = useState<Screen>('play')
  const [library, setLibrary] = useState<Puzzle[]>(loadLibrary)
  const [activePuzzle, setActivePuzzle] = useState<Puzzle>(() => generatePuzzle('easy'))

  function updateLibrary(updated: Puzzle[]) {
    setLibrary(updated)
    saveLibrary(updated)
  }

  function handlePlay(puzzle: Puzzle) {
    setActivePuzzle(puzzle)
    setScreen('play')
  }

  function handleNewPuzzle(diff: Puzzle['diff']) {
    setActivePuzzle(generatePuzzle(diff))
    setScreen('play')
  }

  function handleSavePuzzle(puzzle: Puzzle) {
    updateLibrary([...library, puzzle])
    setScreen('library')
  }

  const pageStyle: CSSProperties = {
    maxWidth: 680,
    margin: '0 auto',
    padding: 20,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }

  const navStyle: CSSProperties = {
    display: 'flex',
    gap: 4,
    marginBottom: 24,
    borderBottom: '0.5px solid #eee',
    paddingBottom: 12,
  }

  function navBtnStyle(s: Screen): CSSProperties {
    return {
      fontSize: 13,
      fontWeight: 500,
      background: screen === s ? '#eee' : 'transparent',
      borderRadius: 8,
      border: 'none',
      padding: '6px 14px',
      cursor: 'pointer',
      color: screen === s ? '#111' : '#666',
    }
  }

  return (
    <div style={pageStyle}>
      <nav style={navStyle}>
        {NAV_ORDER.map(s => (
          <button key={s} style={navBtnStyle(s)} onClick={() => setScreen(s)}>
            {NAV_LABELS[s]}
          </button>
        ))}
      </nav>

      {screen === 'play' && (
        <PlayScreen puzzle={activePuzzle} onNewPuzzle={handleNewPuzzle} />
      )}
      {screen === 'library' && (
        <LibraryScreen
          puzzles={library}
          onPlay={handlePlay}
          onEdit={() => setScreen('editor')}
          onSaveGenerated={p => updateLibrary([...library, p])}
          onDelete={id => updateLibrary(library.filter(p => p.id !== id))}
        />
      )}
      {screen === 'editor' && (
        <EditorScreen
          onSave={handleSavePuzzle}
          onBack={() => setScreen('library')}
        />
      )}
    </div>
  )
}

export default App
