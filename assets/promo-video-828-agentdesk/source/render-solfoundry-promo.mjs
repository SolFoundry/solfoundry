import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const WIDTH = 1920
const HEIGHT = 1080
const FPS = 30
const DURATION_SECONDS = 30
const EDGE_PATH =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const root = resolve(process.cwd())
const logoPath = resolve(root, 'assets/logo.png')
const outVideo = resolve(root, 'assets/promo-video-828-agentdesk/final/solfoundry-agent-forge-30s.mp4')
const outThumbnail = resolve(root, 'assets/promo-video-828-agentdesk/final/thumbnail.png')
const outSheet = resolve(root, 'assets/promo-video-828-agentdesk/storyboard/contact-sheet.png')

const logoBuffer = await readFile(logoPath)
const logoDataUri = `data:image/png;base64,${logoBuffer.toString('base64')}`

const browser = await chromium.launch({
  headless: true,
  executablePath: EDGE_PATH,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
})

const page = await browser.newPage({
  viewport: { width: WIDTH, height: HEIGHT },
  deviceScaleFactor: 1,
})

page.on('console', (msg) => console.log(`[render] ${msg.text()}`))

await page.setContent(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        background: #070806;
        overflow: hidden;
      }
      canvas {
        display: block;
      }
    </style>
  </head>
  <body>
    <canvas id="stage" width="${WIDTH}" height="${HEIGHT}"></canvas>
  </body>
</html>
`)

const artifacts = await page.evaluate(
  async ({ logoDataUri, width, height, fps, seconds }) => {
    const canvas = document.getElementById('stage')
    const ctx = canvas.getContext('2d')
    const W = width
    const H = height
    const duration = seconds
    const PI = Math.PI

    const logo = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = logoDataUri
    })

    const palette = {
      bg0: '#070806',
      bg1: '#10120f',
      steel: '#2e3430',
      steel2: '#48514a',
      ember: '#ff7a1a',
      gold: '#f6c64f',
      mint: '#31e58f',
      text: '#f4efe5',
      muted: '#b8b09e',
      red: '#ff4d3d',
      blue: '#78a6ff',
    }

    const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v))
    const mix = (a, b, t) => a + (b - a) * t
    const ease = (t) => {
      const x = clamp(t)
      return x * x * (3 - 2 * x)
    }
    const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3)
    const local = (time, start, end) => clamp((time - start) / (end - start))
    const pulse = (time, speed = 1) => (Math.sin(time * speed * PI * 2) + 1) / 2

    function color(hex, alpha = 1) {
      const clean = hex.replace('#', '')
      const r = parseInt(clean.slice(0, 2), 16)
      const g = parseInt(clean.slice(2, 4), 16)
      const b = parseInt(clean.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    function roundRect(x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2)
      ctx.beginPath()
      ctx.moveTo(x + rr, y)
      ctx.arcTo(x + w, y, x + w, y + h, rr)
      ctx.arcTo(x + w, y + h, x, y + h, rr)
      ctx.arcTo(x, y + h, x, y, rr)
      ctx.arcTo(x, y, x + w, y, rr)
      ctx.closePath()
    }

    function fillRound(x, y, w, h, r, fill, stroke = null, lw = 1) {
      roundRect(x, y, w, h, r)
      ctx.fillStyle = fill
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = lw
        ctx.stroke()
      }
    }

    function text(value, x, y, size, weight = 600, fill = palette.text, align = 'left') {
      ctx.font = `${weight} ${size}px Segoe UI, Inter, Arial, sans-serif`
      ctx.fillStyle = fill
      ctx.textAlign = align
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(value, x, y)
    }

    function wrap(value, maxWidth, size, weight = 500) {
      ctx.font = `${weight} ${size}px Segoe UI, Inter, Arial, sans-serif`
      const words = value.split(' ')
      const lines = []
      let line = ''
      for (const word of words) {
        const trial = line ? `${line} ${word}` : word
        if (ctx.measureText(trial).width > maxWidth && line) {
          lines.push(line)
          line = word
        } else {
          line = trial
        }
      }
      if (line) lines.push(line)
      return lines
    }

    function background(time) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, '#070806')
      g.addColorStop(0.55, '#14110d')
      g.addColorStop(1, '#1c1209')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)

      ctx.save()
      ctx.globalAlpha = 0.9
      const furnace = ctx.createRadialGradient(W * 0.68, H * 0.74, 40, W * 0.68, H * 0.74, 780)
      furnace.addColorStop(0, color(palette.ember, 0.38 + pulse(time, 0.18) * 0.12))
      furnace.addColorStop(0.35, color(palette.gold, 0.16))
      furnace.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = furnace
      ctx.fillRect(0, 0, W, H)
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = 0.28
      ctx.strokeStyle = '#3b3527'
      ctx.lineWidth = 2
      for (let x = -200; x < W + 200; x += 88) {
        ctx.beginPath()
        ctx.moveTo(x + ((time * 28) % 88), 0)
        ctx.lineTo(x - 440 + ((time * 28) % 88), H)
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = 0.95
      for (let i = 0; i < 84; i += 1) {
        const seed = i * 97.13
        const x = ((Math.sin(seed) * 0.5 + 0.5) * W + time * (26 + (i % 5) * 8)) % W
        const y = (Math.cos(seed * 1.7) * 0.5 + 0.5) * H
        const life = pulse(time + i * 0.031, 0.9)
        const r = 1.5 + life * 3.2
        ctx.fillStyle = color(i % 3 === 0 ? palette.mint : palette.gold, 0.2 + life * 0.5)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, PI * 2)
        ctx.fill()
      }
      ctx.restore()

      ctx.save()
      const lava = ctx.createLinearGradient(0, H - 170, W, H)
      lava.addColorStop(0, color(palette.ember, 0.04))
      lava.addColorStop(0.48, color(palette.ember, 0.46))
      lava.addColorStop(1, color(palette.gold, 0.18))
      ctx.fillStyle = lava
      ctx.beginPath()
      ctx.moveTo(0, H - 95)
      for (let x = 0; x <= W; x += 36) {
        const y = H - 112 + Math.sin(x / 85 + time * 1.45) * 14 + Math.sin(x / 31 + time * 0.8) * 5
        ctx.lineTo(x, y)
      }
      ctx.lineTo(W, H)
      ctx.lineTo(0, H)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    function header(time) {
      ctx.save()
      ctx.globalAlpha = 0.98
      ctx.drawImage(logo, 72, 58, 240, 78)
      fillRound(W - 438, 55, 360, 58, 12, color('#111711', 0.78), color(palette.mint, 0.42), 1.5)
      text('solfoundry.io', W - 258, 93, 28, 650, palette.mint, 'center')
      ctx.restore()
    }

    function anvil(cx, cy, scale, glow = 1) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.shadowColor = color(palette.ember, 0.45 * glow)
      ctx.shadowBlur = 42 * glow
      ctx.fillStyle = '#1e231f'
      ctx.strokeStyle = color(palette.gold, 0.55)
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(-310, -70)
      ctx.lineTo(185, -70)
      ctx.quadraticCurveTo(260, -66, 320, -118)
      ctx.lineTo(250, -18)
      ctx.quadraticCurveTo(210, 32, 130, 32)
      ctx.lineTo(40, 32)
      ctx.lineTo(0, 132)
      ctx.lineTo(-118, 132)
      ctx.lineTo(-142, 32)
      ctx.lineTo(-306, 32)
      ctx.quadraticCurveTo(-370, 26, -384, -28)
      ctx.quadraticCurveTo(-372, -70, -310, -70)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      fillRound(-168, 132, 218, 44, 10, '#151814', color(palette.gold, 0.44), 5)
      fillRound(-235, 176, 352, 52, 10, '#111410', color(palette.gold, 0.34), 5)
      ctx.restore()
    }

    function moltenRail(y, time, progress) {
      ctx.save()
      const x0 = 220
      const x1 = W - 220
      ctx.lineCap = 'round'
      ctx.lineWidth = 24
      ctx.strokeStyle = color('#272b26', 0.95)
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(x1, y)
      ctx.stroke()
      ctx.lineWidth = 10
      ctx.strokeStyle = color(palette.ember, 0.95)
      ctx.beginPath()
      ctx.moveTo(x0, y)
      ctx.lineTo(mix(x0, x1, progress), y)
      ctx.stroke()
      ctx.fillStyle = color(palette.gold, 0.35 + pulse(time, 1.7) * 0.35)
      ctx.beginPath()
      ctx.arc(mix(x0, x1, progress), y, 24 + pulse(time, 1.3) * 8, 0, PI * 2)
      ctx.fill()
      ctx.restore()
    }

    function stageCard(label, sub, x, y, w, h, active, tint) {
      ctx.save()
      const lift = active ? -18 : 0
      const border = active ? color(tint, 0.86) : color('#ffffff', 0.14)
      const fill = active ? color('#141913', 0.92) : color('#10120f', 0.78)
      fillRound(x, y + lift, w, h, 18, fill, border, active ? 3 : 1.5)
      ctx.fillStyle = active ? color(tint, 0.18) : color('#ffffff', 0.05)
      ctx.fillRect(x + 2, y + lift + 2, w - 4, 56)
      fillRound(x + 28, y + lift + 32, 66, 66, 16, color(tint, active ? 0.23 : 0.11), color(tint, 0.58), 2)
      text(label, x + 112, y + lift + 72, 42, 760, palette.text)
      for (const [i, line] of wrap(sub, w - 68, 28, 500).entries()) {
        text(line, x + 34, y + lift + 142 + i * 38, 28, 500, palette.muted)
      }
      ctx.restore()
    }

    function titleBlock(k, title, subtitle) {
      ctx.save()
      ctx.globalAlpha = easeOut(k)
      ctx.translate(0, (1 - easeOut(k)) * 42)
      text(title, 96, 304, 96, 790, palette.text)
      for (const [i, line] of wrap(subtitle, 900, 38, 500).entries()) {
        text(line, 102, 372 + i * 54, 38, 500, palette.muted)
      }
      ctx.restore()
    }

    function drawOpening(time) {
      const k = local(time, 0, 3.4)
      ctx.save()
      ctx.globalAlpha = easeOut(k)
      anvil(W * 0.66, H * 0.56, 0.92, 1.2)
      ctx.restore()
      titleBlock(k, 'AI work, forged on-chain', 'SolFoundry turns open bounties into a clear path: post work, fund it, review submissions, and pay builders.')
      moltenRail(790, time, local(time, 0.8, 3.6))
    }

    function drawFlow(time) {
      const p = local(time, 4, 14)
      const active = Math.floor(clamp(p * 4, 0, 3.99))
      text('The bounty marketplace loop', 96, 228, 76, 800, palette.text)
      text('A simple flow built for agents, builders, and token-funded work.', 102, 292, 34, 500, palette.muted)
      const cards = [
        ['POST', 'Describe the task, reward, and acceptance criteria.', palette.blue],
        ['FUND', 'Lock the reward so builders know the bounty is real.', palette.ember],
        ['REVIEW', 'Use AI and maintainers to score quality before merge.', palette.mint],
        ['EARN', 'Ship accepted work and receive FNDRY payout.', palette.gold],
      ]
      cards.forEach((card, i) => {
        const appear = easeOut(local(time, 4.2 + i * 0.42, 5.6 + i * 0.42))
        ctx.save()
        ctx.globalAlpha = appear
        ctx.translate(0, (1 - appear) * 70)
        stageCard(card[0], card[1], 120 + i * 435, 430, 370, 260, active === i, card[2])
        ctx.restore()
      })
      moltenRail(780, time, p)
    }

    function drawFactory(time) {
      const k = local(time, 14, 21.5)
      text('From issue to accepted PR', 96, 214, 78, 800, palette.text)
      text('The forge makes every step visible: requirements, escrow, review, and payout proof.', 102, 278, 34, 500, palette.muted)

      const beltY = 680
      ctx.save()
      fillRound(170, beltY - 70, W - 340, 150, 18, color('#171b17', 0.94), color('#ffffff', 0.11), 2)
      for (let x = 190 - ((time * 84) % 78); x < W - 170; x += 78) {
        ctx.strokeStyle = color('#5d665e', 0.4)
        ctx.lineWidth = 8
        ctx.beginPath()
        ctx.moveTo(x, beltY - 58)
        ctx.lineTo(x + 58, beltY + 66)
        ctx.stroke()
      }
      ctx.restore()

      const packetX = mix(210, W - 500, ease(k))
      fillRound(packetX, beltY - 154, 410, 238, 22, color('#10130f', 0.96), color(palette.gold, 0.58), 3)
      text('Bounty Packet', packetX + 34, beltY - 92, 42, 760, palette.text)
      text('Requirements', packetX + 36, beltY - 32, 28, 600, palette.muted)
      text('Reward funded', packetX + 36, beltY + 12, 28, 600, palette.muted)
      text('Review rubric', packetX + 36, beltY + 56, 28, 600, palette.muted)

      ctx.save()
      const press = Math.sin(clamp(local(time, 16.6, 19.2)) * PI)
      const pressY = mix(265, 410, press)
      fillRound(W - 460, 190, 110, 520, 18, color('#222822', 0.95), color('#ffffff', 0.14), 2)
      fillRound(W - 604, pressY, 400, 94, 16, color(palette.ember, 0.22), color(palette.ember, 0.84), 4)
      text('AI REVIEWED', W - 404, pressY + 60, 42, 820, palette.gold, 'center')
      ctx.restore()
    }

    function drawPayout(time) {
      const k = local(time, 21.5, 26)
      titleBlock(local(time, 21.5, 23), 'Accepted work becomes payout', 'When quality clears the review bar, contributors get paid in FNDRY and level up for larger bounties.')

      ctx.save()
      const cx = W * 0.68
      const cy = H * 0.54
      const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 420)
      glow.addColorStop(0, color(palette.gold, 0.34))
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, W, H)
      for (let i = 0; i < 10; i += 1) {
        const angle = (i / 10) * PI * 2 + time * 0.9
        const radius = 118 + i * 21 + ease(k) * 110
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius * 0.54
        fillRound(x - 58, y - 58, 116, 116, 58, color('#11150f', 0.95), color(palette.gold, 0.75), 3)
        text('FNDRY', x, y + 11, 24, 760, palette.gold, 'center')
      }
      fillRound(cx - 208, cy - 92, 416, 184, 24, color('#10140f', 0.94), color(palette.mint, 0.66), 4)
      text('MERGED', cx, cy - 15, 56, 830, palette.mint, 'center')
      text('Reward released', cx, cy + 45, 32, 600, palette.text, 'center')
      ctx.restore()
    }

    function drawFinal(time) {
      const k = local(time, 26, 30)
      ctx.save()
      ctx.globalAlpha = easeOut(k)
      ctx.drawImage(logo, W / 2 - 330, 245, 660, 214)
      text('Post. Fund. Review. Earn.', W / 2, 550, 78, 820, palette.text, 'center')
      text('The bounty forge for AI agents and Solana builders.', W / 2, 620, 38, 540, palette.muted, 'center')
      fillRound(W / 2 - 280, 710, 560, 74, 18, color(palette.mint, 0.16), color(palette.mint, 0.76), 2)
      text('Start at solfoundry.io', W / 2, 760, 34, 760, palette.mint, 'center')
      ctx.restore()
    }

    function timeline(time) {
      const p = clamp(time / duration)
      ctx.save()
      ctx.globalAlpha = 0.92
      fillRound(96, H - 72, W - 192, 12, 6, color('#ffffff', 0.14))
      fillRound(96, H - 72, (W - 192) * p, 12, 6, color(palette.gold, 0.92))
      text('30s promo - 1080p MP4 - original synth bed', 96, H - 96, 24, 560, color('#ffffff', 0.74))
      ctx.restore()
    }

    function drawFrame(time) {
      background(time)
      header(time)
      if (time < 4) drawOpening(time)
      else if (time < 14) drawFlow(time)
      else if (time < 21.5) drawFactory(time)
      else if (time < 26) drawPayout(time)
      else drawFinal(time)
      timeline(time)
    }

    function makeAudioStream() {
      const audio = new AudioContext({ sampleRate: 48000 })
      const dest = audio.createMediaStreamDestination()
      const master = audio.createGain()
      master.gain.value = 0.045
      master.connect(dest)

      const compressor = audio.createDynamicsCompressor()
      compressor.threshold.value = -26
      compressor.knee.value = 20
      compressor.ratio.value = 4
      compressor.attack.value = 0.01
      compressor.release.value = 0.18
      compressor.connect(master)

      function tone(freq, start, length, gain, type = 'sawtooth') {
        const osc = audio.createOscillator()
        const g = audio.createGain()
        osc.type = type
        osc.frequency.value = freq
        g.gain.setValueAtTime(0, audio.currentTime + start)
        g.gain.linearRampToValueAtTime(gain, audio.currentTime + start + 0.04)
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + length)
        osc.connect(g)
        g.connect(compressor)
        osc.start(audio.currentTime + start)
        osc.stop(audio.currentTime + start + length + 0.05)
      }

      const root = 55
      for (let bar = 0; bar < 30; bar += 1) {
        const base = bar % 8 < 4 ? root : root * 1.122
        tone(base, bar, 0.82, 0.34, 'sawtooth')
        tone(base * 2, bar + 0.5, 0.28, 0.12, 'triangle')
        tone(base * 4, bar + 0.25, 0.12, 0.05, 'square')
      }
      for (let hit = 0; hit < 60; hit += 1) {
        const start = hit * 0.5
        tone(880 + (hit % 4) * 110, start, 0.05, hit % 4 === 0 ? 0.1 : 0.055, 'square')
      }
      return { audio, stream: dest.stream }
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    function canvasPngBase64(sourceCanvas = canvas) {
      return sourceCanvas.toDataURL('image/png').split(',')[1]
    }

    async function makeContactSheet() {
      const sheet = document.createElement('canvas')
      sheet.width = 1920
      sheet.height = 720
      const sctx = sheet.getContext('2d')
      const times = [1.5, 6, 11.5, 17, 23, 28]
      for (const [i, t] of times.entries()) {
        drawFrame(t)
        const x = (i % 3) * 640
        const y = Math.floor(i / 3) * 360
        sctx.drawImage(canvas, x, y, 640, 360)
        sctx.fillStyle = 'rgba(0,0,0,0.66)'
        sctx.fillRect(x, y + 310, 640, 50)
        sctx.fillStyle = '#f6c64f'
        sctx.font = '700 24px Segoe UI, Arial'
        sctx.fillText(`${String(Math.round(t)).padStart(2, '0')}s`, x + 20, y + 343)
      }
      return canvasPngBase64(sheet)
    }

    if (!MediaRecorder.isTypeSupported('video/mp4')) {
      throw new Error('This Edge/Chromium build does not support MediaRecorder video/mp4.')
    }

    const { audio, stream: audioStream } = makeAudioStream()
    await audio.resume()
    const videoStream = canvas.captureStream(fps)
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ])

    const recorder = new MediaRecorder(combined, {
      mimeType: 'video/mp4',
      videoBitsPerSecond: 2800000,
      audioBitsPerSecond: 96000,
    })
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    }

    const videoBase64 = await new Promise((resolve, reject) => {
      recorder.onerror = () => reject(recorder.error)
      recorder.onstop = async () => {
        try {
          await audio.close()
          const blob = new Blob(chunks, { type: 'video/mp4' })
          resolve(await blobToBase64(blob))
        } catch (error) {
          reject(error)
        }
      }

      const start = performance.now()
      recorder.start(1000)
      const tick = (now) => {
        const time = Math.min(duration, (now - start) / 1000)
        drawFrame(time)
        if (time < duration) {
          requestAnimationFrame(tick)
        } else {
          drawFrame(duration)
          recorder.stop()
        }
      }
      requestAnimationFrame(tick)
    })

    drawFrame(28)
    const thumbnailBase64 = canvasPngBase64()
    const sheetBase64 = await makeContactSheet()

    return { videoBase64, thumbnailBase64, sheetBase64 }
  },
  { logoDataUri, width: WIDTH, height: HEIGHT, fps: FPS, seconds: DURATION_SECONDS },
)

await browser.close()

await mkdir(dirname(outVideo), { recursive: true })
await mkdir(dirname(outSheet), { recursive: true })
await writeFile(outVideo, Buffer.from(artifacts.videoBase64, 'base64'))
await writeFile(outThumbnail, Buffer.from(artifacts.thumbnailBase64, 'base64'))
await writeFile(outSheet, Buffer.from(artifacts.sheetBase64, 'base64'))

console.log(`Wrote ${outVideo}`)
console.log(`Wrote ${outThumbnail}`)
console.log(`Wrote ${outSheet}`)
