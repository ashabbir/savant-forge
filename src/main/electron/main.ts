import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import packageJson from '../../../package.json'

type SavantShellConfig = {
  appName?: string
  icon?: string
}

const shellConfig = (packageJson.savantShell || {}) as SavantShellConfig
const appName = shellConfig.appName || packageJson.productName || packageJson.name
const iconName = shellConfig.icon || 'main.svg'

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(__dirname, '../src/renderer/public')

let win: BrowserWindow | null = null
let tray: Tray | null = null

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function resolveAsset(name: string) {
  const packaged = path.join(process.resourcesPath || '', 'public', name)
  const devPath = path.join(process.env.VITE_PUBLIC || '', name)
  return app.isPackaged ? packaged : devPath
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#111319',
    title: appName,
    icon: resolveAsset(iconName),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (VITE_DEV_SERVER_URL) {
    const devUrl = VITE_DEV_SERVER_URL
    win.webContents.on('did-fail-load', (_event, _errorCode, _errorDescription, validatedUrl) => {
      if (validatedUrl.startsWith(devUrl)) {
        setTimeout(() => win?.loadURL(devUrl), 500)
      }
    })
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
}

function createTray() {
  const trayIconName = 'tray.png'
  let icon = nativeImage.createFromPath(resolveAsset(trayIconName))

  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(resolveAsset(iconName)).resize({ width: 16, height: 16 })
  }

  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }

  tray = new Tray(icon)
  tray.setToolTip(appName)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Open ${appName}`, click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]))
}

app.whenReady().then(() => {
  app.setName(appName)
  createWindow()
  createTray()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
    tray = null
  }
})
