import { createContext } from 'react'

export type BackgroundStyle = 'none' | 'glass-glow' | 'wood-grain' | 'neon-veil' | 'paper-grain'
export type TileStyle = 'plain' | 'glass' | 'ceramic' | 'neon-outline' | 'paper'
export type ThemePreset = 'minimalist' | 'glass' | 'wood' | 'neon' | 'paper'

export interface ThemeConfig {
  background: BackgroundStyle
  tile: TileStyle
}

export const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  minimalist: { background: 'none', tile: 'plain' },
  glass:      { background: 'glass-glow', tile: 'glass' },
  wood:       { background: 'wood-grain', tile: 'ceramic' },
  neon:       { background: 'neon-veil', tile: 'neon-outline' },
  paper:      { background: 'paper-grain', tile: 'paper' },
}

export const PRESET_LABELS: Record<ThemePreset, string> = {
  minimalist: 'Minimalist',
  glass:      'Glass',
  wood:       'Wood',
  neon:       'Neon',
  paper:      'Paper',
}

export const BACKGROUND_LABELS: Record<BackgroundStyle, string> = {
  'none':        'None (plain)',
  'glass-glow':  'Glass (purple glow)',
  'wood-grain':  'Wood (warm gradient)',
  'neon-veil':   'Neon (animated veil)',
  'paper-grain': 'Paper (parchment)',
}

export const TILE_LABELS: Record<TileStyle, string> = {
  'plain':        'Plain',
  'glass':        'Glass (frosted)',
  'ceramic':      'Ceramic (wood tray)',
  'neon-outline': 'Neon (glowing outline)',
  'paper':        'Paper (serif ink)',
}

export const TileStyleContext = createContext<TileStyle>('plain')
