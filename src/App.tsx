import { useState, type CSSProperties } from 'react'
import type { Puzzle } from './types'
import { loadLibrary, saveLibrary } from './lib/storage'
import { LibraryScreen } from './screens/LibraryScreen'
import { PlayScreen } from './screens/PlayScreen'
import { EditorScreen } from './screens/EditorScreen'

type Screen = 'play' | 'library' | 'editor'

const NAV_LABELS: Record<Screen, string> = { play: 'Play', library: 'Library', editor: 'Editor' }
const NAV_ORDER: Screen[] = ['play', 'library', 'editor']

function App() {
  const [screen, setScreen] = useState<Screen>('play')
  const [library, setLibrary] = useState<Puzzle[]>(loadLibrary)

  function updateLibrary(updated: Puzzle[]) {
    setLibrary(updated)
    saveLibrary(updated)
  }

  function handlePlay(_puzzle: Puzzle) {
    setScreen('play')
  }

  function handleSavePuzzle(puzzle: Puzzle) {
    updateLibrary([...library, puzzle])
    setScreen('library')
  }

  const pageStyle: CSSProperties = {
    maxWidth: 680,
    margin: '0 auto',
    padding: '0 20px 40px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }

  const navStyle: CSSProperties = {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    gap: 0,
  }

  function navBtnStyle(s: Screen): CSSProperties {
    return {
      fontSize: 14,
      color: screen === s ? '#222' : '#999',
      fontWeight: screen === s ? 500 : 400,
      background: 'transparent',
      border: 'none',
      padding: '6px 12px',
      cursor: 'pointer',
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

      <div style={{ minHeight: 600 }}>
        {screen === 'play' && (
          <PlayScreen activeScreen={screen} onNav={setScreen} />
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
    </div>
  )
}

export default App
