/**
 * Logo da VIKSA Group para os PDFs. O ficheiro vive em
 * public/assets/logo/viksa-group-logo.png (substituível sem tocar no código).
 * Carrega uma vez, guarda em cache, e devolve o data-URL + dimensões reais para
 * manter a proporção original ao inserir no PDF. Se o ficheiro faltar, devolve
 * null e as funções de PDF caem no cabeçalho de texto.
 */
export interface LogoData {
  dataUrl: string
  width: number
  height: number
}

const LOGO_PATH = '/assets/logo/viksa-group-logo.png'
export const LOGO_NOME = 'VIKSA Group'

let cache: Promise<LogoData | null> | null = null

export function carregarLogo(): Promise<LogoData | null> {
  if (cache) return cache
  cache = (async () => {
    try {
      const res = await fetch(LOGO_PATH)
      if (!res.ok) return null
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.onerror = () => reject(fr.error)
        fr.readAsDataURL(blob)
      })
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => reject(new Error('logo inválido'))
        img.src = dataUrl
      })
      return { dataUrl, ...dims }
    } catch {
      return null
    }
  })()
  return cache
}
