import { contextBridge } from 'electron'
import packageJson from '../../../package.json'

const shellConfig = packageJson.savantShell || {}

contextBridge.exposeInMainWorld('savantShell', {
  appName: shellConfig.appName || packageJson.productName || packageJson.name,
  appVersion: packageJson.version,
  icon: shellConfig.icon || 'main.svg',
  theme: shellConfig.theme || 'obsidian',
  serverUrl: process.env.SAVANT_SERVER_URL || shellConfig.serverUrl || 'http://127.0.0.1:8090',
  gatewayUrl: process.env.SAVANT_GATEWAY_URL || shellConfig.gatewayUrl || 'http://127.0.0.1:3100'
})
