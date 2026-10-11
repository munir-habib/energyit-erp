// Paleta de dataviz validada (ver skill "dataviz") — ordem fixa, nunca ciclada.
export interface ChartPalette {
  surface: string
  ink: string
  inkSecondary: string
  inkMuted: string
  grid: string
  axis: string
  categorical: string[]
  sequential: string
  good: string
  warning: string
}

const light: ChartPalette = {
  surface: '#f7f6ef',
  ink: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#7a7a6e',
  grid: '#d9d7c8',
  axis: '#c3c2b7',
  categorical: ['#16543a', '#c9a24b', '#2e6b4a', '#8c6a1f'],
  sequential: '#16543a',
  good: '#16543a',
  warning: '#c9a24b',
}

const dark: ChartPalette = {
  surface: '#151e19',
  ink: '#ffffff',
  inkSecondary: '#c3c2b7',
  inkMuted: '#898781',
  grid: '#26332b',
  axis: '#334039',
  categorical: ['#3f8a5c', '#e8c97a', '#2e6b4a', '#c9a24b'],
  sequential: '#3f8a5c',
  good: '#3f8a5c',
  warning: '#e8c97a',
}

export function chartPalette(theme: 'light' | 'dark'): ChartPalette {
  return theme === 'dark' ? dark : light
}
