const { spawn } = require('node:child_process')
const http = require('node:http')

const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
const timeoutMs = 15000
const startedAt = Date.now()

function check() {
  const req = http.get(url, (res) => {
    res.resume()
    launch()
  })

  req.on('error', () => {
    if (Date.now() - startedAt > timeoutMs) {
      console.error(`Timed out waiting for Vite at ${url}`)
      process.exit(1)
    }
    setTimeout(check, 150)
  })

  req.setTimeout(1000, () => {
    req.destroy()
  })
}

function launch() {
  const child = spawn('electron', ['.'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: url
    }
  })

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code || 0)
  })
}

check()
