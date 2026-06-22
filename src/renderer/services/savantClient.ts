export type ConnectionStatus = 'online' | 'offline' | 'checking'

export type SavantProfile = {
  userId: string
  name: string
  role: string
}

export type HealthState = {
  status: ConnectionStatus
  detail: string
}

export type GatewayProvider = {
  id: string
  label: string
  models: string[]
}

const API_KEY_STORAGE_KEY = 'savant_api_key'

export function getStoredApiKey() {
  try {
    const storage = globalThis.window?.localStorage
    return storage?.getItem(API_KEY_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredApiKey(apiKey: string) {
  try {
    const storage = globalThis.window?.localStorage
    if (!storage) return
    if (apiKey.trim()) {
      storage.setItem(API_KEY_STORAGE_KEY, apiKey.trim())
    } else {
      storage.removeItem(API_KEY_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable in tests or hardened browser contexts.
  }
}

function appendAuthHeader(headers: Headers, apiKey = getStoredApiKey()) {
  if (apiKey && !headers.has('X-API-Key')) {
    headers.set('X-API-Key', apiKey)
  }
  return headers
}

async function fetchJson(url: string, init: RequestInit = {}, skipAuth = false) {
  const headers = skipAuth ? new Headers(init.headers) : appendAuthHeader(new Headers(init.headers))
  const response = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(3500)
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `${response.status} ${response.statusText}`)
  }

  return data
}

export async function checkServerHealth(serverUrl: string): Promise<HealthState> {
  const paths = ['/api/db/health', '/health/ready', '/health/live']

  for (const healthPath of paths) {
    try {
      await fetchJson(`${serverUrl}${healthPath}`, {}, true)
      return { status: 'online', detail: healthPath }
    } catch {
      // Try the next known Savant Server health endpoint.
    }
  }

  return { status: 'offline', detail: 'No health endpoint responded' }
}

export async function checkGatewayHealth(gatewayUrl: string): Promise<HealthState> {
  try {
    await fetchJson(`${gatewayUrl}/health`, {}, true)
    return { status: 'online', detail: '/health' }
  } catch {
    return { status: 'offline', detail: 'Gateway health unavailable' }
  }
}

export async function listGatewayProviders(gatewayUrl: string): Promise<GatewayProvider[]> {
  const baseUrl = gatewayUrl.replace(/\/+$/, '')
  try {
    const data = await fetchJson(`${baseUrl}/models`, {}, true)
    return normalizeGatewayProviders(data)
  } catch {
    const health = await fetchJson(`${baseUrl}/health`, {}, true)
    return normalizeGatewayProviders(health)
  }
}

export async function login(serverUrl: string, apiKey: string): Promise<SavantProfile> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key is required')
  }

  const response = await fetch(`${serverUrl}/api/auth/validate`, {
    headers: { 'X-API-Key': trimmed },
    signal: AbortSignal.timeout(3500)
  })

  if (!response.ok) {
    throw new Error('Savant Server rejected this API key')
  }

  setStoredApiKey(trimmed)
  return normalizeProfile(await readJson(response))
}

export function logout() {
  setStoredApiKey('')
}

export async function loadProfile(serverUrl: string): Promise<SavantProfile | null> {
  if (!getStoredApiKey()) return null

  try {
    const data = await fetchJson(`${serverUrl}/api/auth/validate`)
    return normalizeProfile(data)
  } catch {
    logout()
    return null
  }
}

async function readJson(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  return contentType.includes('application/json') ? response.json() : {}
}

function normalizeProfile(data: any): SavantProfile {
  const identity = data?.identity || data?.user || data || {}
  const userId = String(identity.userId || identity.id || identity.username || '').trim()
  const name = String(identity.name || identity.displayName || identity.email || userId || 'Savant User').trim()
  const role = String(identity.role || data?.role || 'user').trim().toLowerCase()

  return { userId, name, role }
}

function normalizeGatewayProviders(data: any): GatewayProvider[] {
  const rawProviders = Array.isArray(data?.providers)
    ? data.providers
    : Array.isArray(data)
    ? data
    : data?.providerDetails && typeof data.providerDetails === 'object'
    ? Object.entries(data.providerDetails).map(([id, details]: [string, any]) => ({ id, ...details }))
    : []

  return rawProviders
    .map((provider: any) => {
      const id = String(provider.id || provider.name || provider.provider || '').trim()
      const label = String(provider.label || provider.displayName || provider.name || id).trim()
      const models = Array.isArray(provider.models)
        ? provider.models
        : Array.isArray(provider.availableModels)
        ? provider.availableModels
        : provider.defaultModel
        ? [provider.defaultModel]
        : []

      return {
        id,
        label: label || id,
        models: models.map((model: any) => String(model)).filter(Boolean)
      }
    })
    .filter((provider: GatewayProvider) => provider.id && provider.models.length > 0)
}
