import type { CSSProperties } from 'react'

interface Props {
  moves: number
  undos: number
  rackLeft: number
  setsValid: number
  totalSets: number
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
  marginBottom: 20,
}

const cellStyle: CSSProperties = {
  background: '#f5f5f5',
  borderRadius: 8,
  padding: 10,
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#999',
  marginBottom: 2,
}

const valueStyle: CSSProperties = {
  display: 'block',
  fontSize: 20,
  fontWeight: 500,
}

const STATS = (moves: number, undos: number, rackLeft: number, setsValid: number, totalSets: number) => [
  { label: 'Moves',  value: moves },
  { label: 'Undos',  value: undos },
  { label: 'Rack',   value: rackLeft },
  { label: 'Valid',  value: `${setsValid}/${totalSets}` },
]

export function StatsBar({ moves, undos, rackLeft, setsValid, totalSets }: Props) {
  return (
    <div style={gridStyle}>
      {STATS(moves, undos, rackLeft, setsValid, totalSets).map(({ label, value }) => (
        <div key={label} style={cellStyle}>
          <span style={labelStyle}>{label}</span>
          <span style={valueStyle}>{value}</span>
        </div>
      ))}
    </div>
  )
}
