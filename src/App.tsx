import { useState } from 'react'
import type { Puzzle } from './types'
import { loadLibrary, saveLibrary } from './lib/storage'
import { LibraryScreen } from './screens/LibraryScreen'
import { PlayScreen } from './screens/PlayScreen'
import { EditorScreen } from './screens/EditorScreen'

type Screen = 'library' | 'play' | 'editor'

function App() {
  const [screen, setScreen] = useState<Screen>('library')
  const [library, setLibrary] = useState<Puzzle[]>(loadLibrary)
  const [activePuzzle, setActivePuzzle] = useState<Puzzle | null>(null)

  function updateLibrary(updated: Puzzle[]) {
    setLibrary(updated)
    saveLibrary(updated)
  }

  function handlePlay(puzzle: Puzzle) {
    setActivePuzzle(puzzle)
    setScreen('play')
  }

  function handleSavePuzzle(puzzle: Puzzle) {
    updateLibrary([...library, puzzle])
    setScreen('library')
  }

  return (
    <>
      {screen === 'library' && (
        <LibraryScreen
          puzzles={library}
          onPlay={handlePlay}
          onEdit={() => setScreen('editor')}
          onSaveGenerated={p => updateLibrary([...library, p])}
          onDelete={id => updateLibrary(library.filter(p => p.id !== id))}
        />
      )}
      {screen === 'play' && activePuzzle && (
        <PlayScreen
          puzzle={activePuzzle}
          onBack={() => setScreen('library')}
        />
      )}
      {screen === 'editor' && (
        <EditorScreen
          onSave={handleSavePuzzle}
          onBack={() => setScreen('library')}
        />
      )}
    </>
  )
}

export default App
