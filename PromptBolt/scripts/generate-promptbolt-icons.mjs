/**
 * Generates store-ready PNG icons (16 / 48 / 128). Run: npm run icons
 */
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'icons')

function setPx(data, width, x, y, r, g, b, a) {
  const i = (width * y + x) << 2
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = a
}

function drawIcon(size) {
  const png = new PNG({ width: size, height: size })
  const { data, width, height } = png
  const cx = (size - 1) / 2
  const cy = (size - 1) / 2
  const R = size * 0.44

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)

      if (d > R + 1.25) {
        setPx(data, width, x, y, 5, 5, 8, 0)
        continue
      }

      const t = x / Math.max(1, size - 1)
      const u = y / Math.max(1, size - 1)
      const r = Math.round(147 + 90 * t)
      const g = Math.round(51 + 70 * u)
      const b = Math.round(234 - 40 * t * u)
      let a = 255
      if (d > R - 0.75) {
        a = Math.max(0, Math.min(255, Math.round(255 * (R + 1.25 - d))))
      }
      setPx(data, width, x, y, r, g, b, a)
    }
  }

  /** Simple “lightning” slash in high-contrast white (reads at 16px). */
  const thick = Math.max(1, Math.round(size / 16))
  for (let i = 0; i < size; i++) {
    const px = Math.round(cx - size * 0.08 + i * 0.35)
    const py = Math.round(cy - size * 0.2 + i * 0.62)
    for (let tx = -thick; tx <= thick; tx++) {
      for (let ty = -thick; ty <= thick; ty++) {
        const x = px + tx
        const y = py + ty
        if (x >= 0 && y >= 0 && x < width && y < height) {
          const dd = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
          if (dd <= R - thick) {
            setPx(data, width, x, y, 255, 255, 255, 235)
          }
        }
      }
    }
  }

  return PNG.sync.write(png)
}

fs.mkdirSync(outDir, { recursive: true })
for (const s of [16, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${s}.png`), drawIcon(s))
}
