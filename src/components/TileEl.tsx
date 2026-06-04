import type { Tile, DragSrc } from '../types'

const COLOR_CLASS: Record<Tile['c'], string> = {
  r: 'tile--red',
  b: 'tile--blue',
  a: 'tile--orange',
  k: 'tile--black',
}

interface Props {
  tile: Tile
  src: DragSrc
  onDragStart: (src: DragSrc) => void
  onDragEnd: () => void
}

export function TileEl({ tile, src, onDragStart, onDragEnd }: Props) {
  return (
    <div
      className={`tile ${COLOR_CLASS[tile.c]}`}
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('application/json', JSON.stringify(src))
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(src)
      }}
      onDragEnd={onDragEnd}
    >
      {tile.n}
    </div>
  )
}
