// Copia o motor de OCR (tesseract.js) e o modelo de português de node_modules para public/ocr/, para a
// leitura automática de faturas funcionar 100% offline — por omissão o tesseract.js iria buscar estes
// ficheiros a uma CDN no momento de ler. Corre antes de `dev` e `build` (ver package.json).
// public/ocr/ está no .gitignore: é sempre regenerado a partir das dependências instaladas.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')
const out = join(root, 'public', 'ocr')

function copiar(origem, destino) {
  mkdirSync(dirname(destino), { recursive: true })
  if (!existsSync(origem)) throw new Error(`Falta ${origem} — corra npm install`)
  copyFileSync(origem, destino)
}

copiar(join(nm, 'tesseract.js', 'dist', 'worker.min.js'), join(out, 'worker.min.js'))

// Só as variantes LSTM do core (o reconhecimento corre em modo LSTM_ONLY); o tesseract.js escolhe a
// variante conforme o browser (SIMD / relaxed SIMD / sem SIMD).
const coreDir = join(nm, 'tesseract.js-core')
for (const f of readdirSync(coreDir).filter((f) => /^tesseract-core.*lstm\.wasm\.js$/.test(f))) {
  copiar(join(coreDir, f), join(out, 'core', f))
}

// Modelo "best_int" de português (1,4 MB comprimido).
copiar(
  join(nm, '@tesseract.js-data', 'por', '4.0.0_best_int', 'por.traineddata.gz'),
  join(out, 'lang', 'por.traineddata.gz'),
)

console.log('OCR offline: ficheiros copiados para public/ocr/')
