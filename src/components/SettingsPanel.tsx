type ThemeOption = 'light' | 'dark' | 'system'

interface Props {
  theme: ThemeOption
  setTheme: (t: ThemeOption) => void
  soundEnabled: boolean
  setSoundEnabled: (v: boolean) => void
  onClose: () => void
}

const THEME_OPTIONS: { value: ThemeOption; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' },
]

export function SettingsPanel({ theme, setTheme, soundEnabled, setSoundEnabled, onClose }: Props) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100%',
        width: 280,
        background: 'var(--surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Settings</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1, padding: 4 }}
          >×</button>
        </div>

        <Divider />

        <Section label="Appearance">
          <div style={{ display: 'flex', gap: 4 }}>
            {THEME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  background: theme === opt.value ? 'var(--grid-bg)' : 'transparent',
                  color: theme === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: theme === opt.value ? 500 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        <Divider />

        <Section label="Sound">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Snap sound</span>
            <div
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: soundEnabled ? '#185FA5' : 'var(--cell-empty)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: 2,
                left: soundEnabled ? 22 : 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        </Section>

        <Divider />

        <Section label="About">
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Puzzikub</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>A clear-your-rack puzzle game</div>
        </Section>
      </div>
    </>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '0.5px solid var(--border)', margin: 0 }} />
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
