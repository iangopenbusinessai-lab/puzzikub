interface Props {
  moves: number
  undos: number
  rackLeft: number
  setsValid: number
  totalSets: number
}

export function StatsBar({ moves, undos, rackLeft, setsValid, totalSets }: Props) {
  return (
    <div className="stats-bar">
      <span className="stats-bar__item">Moves: <strong>{moves}</strong></span>
      <span className="stats-bar__item">Undos: <strong>{undos}</strong></span>
      <span className="stats-bar__item">Rack: <strong>{rackLeft}</strong></span>
      <span className="stats-bar__item">Valid: <strong>{setsValid}/{totalSets}</strong></span>
    </div>
  )
}
