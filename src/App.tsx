import { useState, useEffect } from 'react'
import type { Puzzle, Screen } from './types'
import { loadLibrary, saveLibrary } from './lib/storage'
import { LibraryScreen } from './screens/LibraryScreen'
import { PlayScreen } from './screens/PlayScreen'
import { EditorScreen } from './screens/EditorScreen'

type ThemeOption = 'light' | 'dark' | 'system'

function resolveTheme(t: ThemeOption): 'light' | 'dark' {
  if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return t
}

function App() {
  const [screen, setScreen] = useState<Screen>('play')
  const [library, setLibrary] = useState<Puzzle[]>(loadLibrary)
  const [theme, setTheme] = useState<ThemeOption>('system')
  const [soundEnabled, setSoundEnabled] = useState(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolveTheme(theme))
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

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

  return (
    <>
      {screen === 'play' && (
        <PlayScreen
          activeScreen={screen}
          onNav={setScreen}
          theme={theme}
          setTheme={setTheme}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
        />
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
    </>
  )
}

export default App
