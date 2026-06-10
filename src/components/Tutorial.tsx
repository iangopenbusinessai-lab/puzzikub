interface Props {
  onDismiss: () => void
}

const TILE_COLORS: Record<string, string> = {
  r: '#A32D2D',
  b: '#185FA5',
  a: '#BA7517',
  k: '#222222',
}

const RULES = [
  'The board starts with complete sets already placed.',
  'You have extra tiles in your rack that must all be placed.',
  'A valid run is 3+ tiles of the same color in consecutive order.',
  'A valid group is 3–4 tiles of the same number in different colors.',
]

function TilePreview({ n, c }: { n: number; c: string }) {
  return (
    <div style={{
      width: 32,
      height: 40,
      borderRadius: 6,
      background: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      fontWeight: 500,
      color: TILE_COLORS[c],
      flexShrink: 0,
    }}>
      {n}
    </div>
  )
}

export function Tutorial({ onDismiss }: Props) {
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          padding: 32,
          maxWidth: 360,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          How to play
        </div>

        {RULES.map((rule, i) => (
          <p key={i} style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
            {rule}
          </p>
        ))}

        <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <TilePreview n={3} c="r" />
              <TilePreview n={4} c="r" />
              <TilePreview n={5} c="r" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>run</div>
          </div>

          <div style={{ width: 16 }} />

          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <TilePreview n={7} c="r" />
              <TilePreview n={7} c="b" />
              <TilePreview n={7} c="k" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>group</div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--text-primary)',
            color: 'var(--bg)',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
