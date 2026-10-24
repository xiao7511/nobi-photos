export function testWave() {
  const rate = 8000,
    samples = rate * 10,
    wave = Buffer.alloc(44 + samples * 2)
  wave.write('RIFF')
  wave.writeUInt32LE(wave.length - 8, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(rate, 24)
  wave.writeUInt32LE(rate * 2, 28)
  wave.writeUInt16LE(2, 32)
  wave.writeUInt16LE(16, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(samples * 2, 40)
  for (let i = 0; i < samples; i++)
    wave.writeInt16LE(Math.round(Math.sin((i * Math.PI * 440) / rate) * 3000), 44 + i * 2)
  return wave
}
