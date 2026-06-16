import type { Screen } from '../types'

const NAV: { label: string; screen: Screen }[] = [
  { label: 'Play', screen: 'play' },
  { label: 'Library', screen: 'library' },
  { label: 'Editor', screen: 'editor' },
]

interface Props {
  activeScreen: Screen
  onNav: (s: Screen) => void
  onShowTutorial: () => void
  onShowSettings: () => void
}

export function NavBar({ activeScreen, onNav, onShowTutorial, onShowSettings }: Props) {
  return (
    <nav style={{
      background: 'var(--surface)',
      borderBottom: '0.5px solid var(--border)',
      padding: '0 20px',
      height: 48,
      display: 'flex',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      transition: 'background 0.15s ease',
    }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: '0 0 80px' }}>Puzzikub</span>
      <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
        {NAV.map(n => (
          <button
            key={n.screen}
            onClick={() => onNav(n.screen)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: n.screen === activeScreen ? '0.5px solid #85B7EB' : '0.5px solid transparent',
              background: n.screen === activeScreen ? '#E8F1FB' : 'transparent',
              color: n.screen === activeScreen ? '#185FA5' : 'var(--text-secondary)',
              fontWeight: n.screen === activeScreen ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {n.label}
          </button>
        ))}
      </div>
      <div style={{ flex: '0 0 80px', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
        <button
          onClick={onShowTutorial}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-secondary)', padding: 4 }}
        >?</button>
        <button
          onClick={onShowSettings}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: 4 }}
        >⚙</button>
      </div>
    </nav>
  )
}
