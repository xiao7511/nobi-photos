import { mkdir, writeFile } from 'node:fs/promises'
import { Buffer } from 'node:buffer'
import { deflateSync } from 'node:zlib'
import console from 'node:console'
const directory = 'artifacts/ios-fixtures'
await mkdir(directory, { recursive: true })
function crc(data) {
  let value = 0xffffffff
  for (const b of data) {
    value ^= b
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}
function chunk(name, data) {
  const body = Buffer.concat([Buffer.from(name), data]),
    size = Buffer.alloc(4),
    checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  checksum.writeUInt32BE(crc(body))
  return Buffer.concat([size, body, checksum])
}
for (let seed = 0; seed < 101; seed++) {
  const pixels = Buffer.alloc(64 * 193)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const p = y * 193 + 1 + x * 3
      pixels[p] = (x * 4 + seed * 31) % 256
      pixels[p + 1] = (y * 4 + seed * 53) % 256
      pixels[p + 2] = ((x + y) * 2 + seed * 23) % 256
    }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(64)
  head.writeUInt32BE(64, 4)
  head[8] = 8
  head[9] = 2
  await writeFile(
    `${directory}/synthetic_${seed}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', head),
      chunk('IDAT', deflateSync(pixels)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}
console.log('Generated 101 synthetic images for the isolated iOS simulator')
