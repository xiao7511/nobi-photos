import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import process from 'node:process'
import console from 'node:console'
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
function chunk(name, data) {
  const body = Buffer.concat([Buffer.from(name), data]),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4)
  let crc = 0xffffffff
  for (const b of body) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  length.writeUInt32BE(data.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([length, body, checksum])
}

// Rasterize the existing website mark; no generated substitute or new brand artwork.
const source = await readFile('public/favicon.svg', 'utf8')
const browser = await chromium.launch({ channel: process.env.NOBI_BROWSER_CHANNEL })
try {
  const page = await browser.newPage()
  async function png(path, size, adaptive = false, rgb = false) {
    const round = path.endsWith('ic_launcher_round.png')
    const svg = adaptive
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g transform="translate(6 6) scale(1.5)">${source.match(/<g[\s\S]*<\/g>/)[0]}</g></svg>`
      : source
    const data = await page.evaluate(
      async ({ svg, size, rgb, round }) => {
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${btoa(svg)}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx = canvas.getContext('2d')
        if (round) {
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
          ctx.clip()
        }
        if (rgb || round) {
          ctx.fillStyle = '#214f42'
          ctx.fillRect(0, 0, size, size)
        }
        ctx.drawImage(image, 0, 0, size, size)
        if (rgb) {
          const rgba = ctx.getImageData(0, 0, size, size).data
          const rows = new Uint8Array(size * (size * 3 + 1))
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              const p = (y * size + x) * 4,
                q = y * (size * 3 + 1) + 1 + x * 3
              rows[q] = rgba[p]
              rows[q + 1] = rgba[p + 1]
              rows[q + 2] = rgba[p + 2]
            }
          let binary = ''
          for (let i = 0; i < rows.length; i += 8192)
            binary += String.fromCharCode(...rows.subarray(i, i + 8192))
          return btoa(binary)
        }
        return canvas.toDataURL('image/png').split(',')[1]
      },
      { svg, size, rgb, round },
    )
    if (rgb) {
      const head = Buffer.alloc(13)
      head.writeUInt32BE(size)
      head.writeUInt32BE(size, 4)
      head[8] = 8
      head[9] = 2
      await writeFile(
        path,
        Buffer.concat([
          Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
          chunk('IHDR', head),
          chunk('IDAT', deflateSync(Buffer.from(data, 'base64'))),
          chunk('IEND', Buffer.alloc(0)),
        ]),
      )
    } else await writeFile(path, Buffer.from(data, 'base64'))
  }
  for (const [density, size, foreground] of [
    ['mdpi', 48, 108],
    ['hdpi', 72, 162],
    ['xhdpi', 96, 216],
    ['xxhdpi', 144, 324],
    ['xxxhdpi', 192, 432],
  ]) {
    const dir = `android/app/src/main/res/mipmap-${density}`
    await mkdir(dir, { recursive: true })
    await png(`${dir}/ic_launcher.png`, size)
    await png(`${dir}/ic_launcher_round.png`, size)
    await png(`${dir}/ic_launcher_foreground.png`, foreground, true)
  }
  await png('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, false, true)
  console.log('NOBI website mark rendered into Android launcher and opaque iOS 1024px icons')
} finally {
  await browser.close()
}
