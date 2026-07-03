import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getStoredApiKey,
  setStoredApiKey,
  checkServerHealth,
  checkGatewayHealth,
  listGatewayProviders,
  login,
  logout,
  loadProfile
} from '../services/savantClient'

describe('savantClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  describe('API Key Storage', () => {
    it('saves and reads key correctly', () => {
      setStoredApiKey('sk-abc')
      expect(getStoredApiKey()).toBe('sk-abc')

      setStoredApiKey('')
      expect(getStoredApiKey()).toBe('')
    })

    it('safely handles storage limitations or exceptions', () => {
      // 1. Getter throws exception (SecurityError / sandboxed iframe)
      const originalLocalStorage = globalThis.window.localStorage
      Object.defineProperty(globalThis.window, 'localStorage', {
        get: () => {
          throw new Error('SecurityError')
        },
        configurable: true
      })
      expect(getStoredApiKey()).toBe('')
      expect(() => setStoredApiKey('key')).not.toThrow()

      // 2. Falsy/undefined storage
      Object.defineProperty(globalThis.window, 'localStorage', {
        get: () => undefined,
        configurable: true
      })
      expect(getStoredApiKey()).toBe('')
      expect(() => setStoredApiKey('key')).not.toThrow()

      // Restore
      Object.defineProperty(globalThis.window, 'localStorage', {
        value: originalLocalStorage,
        configurable: true,
        writable: true
      })
    })
  })

  describe('checkServerHealth', () => {
    it('returns online health if any endpoint responds', async () => {
      // First path fails, second succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ status: 'ok' })
        } as Response)

      const health = await checkServerHealth('http://s-url')
      expect(health.status).toBe('online')
      expect(health.detail).toBe('/health/ready')
    })

    it('returns offline health if all endpoints fail', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('connection refused'))

      const health = await checkServerHealth('http://s-url')
      expect(health.status).toBe('offline')
    })
  })

  describe('checkGatewayHealth', () => {
    it('returns online if gateway responds', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({})
      } as Response)

      const health = await checkGatewayHealth('http://gw-url')
      expect(health.status).toBe('online')
    })

    it('returns offline if gateway health fails', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('refused'))

      const health = await checkGatewayHealth('http://gw-url')
      expect(health.status).toBe('offline')
    })

    it('returns offline if gateway health returns non-ok status code', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Gateway issue' })
      } as Response)

      const health = await checkGatewayHealth('http://gw-url')
      expect(health.status).toBe('offline')
    })

    it('returns offline if server responds with non-ok and non-json', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ 'content-type': 'text/plain' }),
        status: 500,
        statusText: 'Internal Server Error'
      } as Response)

      const health = await checkGatewayHealth('http://gw-url')
      expect(health.status).toBe('offline')
    })
  })

  describe('listGatewayProviders', () => {
    it('normalizes provider models from /models', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          providers: [
            { id: 'codex', label: 'Codex', models: ['gpt-5-codex'] }
          ]
        })
      } as Response)

      const providers = await listGatewayProviders('http://gw-url')

      expect(providers).toEqual([{ id: 'codex', label: 'Codex', models: ['gpt-5-codex'] }])
      expect(fetch).toHaveBeenCalledWith('http://gw-url/models', expect.any(Object))
    })

    it('falls back to providerDetails from /health', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('models unavailable'))
        .mockResolvedValueOnce({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({
            providerDetails: {
              gemini: { label: 'Gemini', availableModels: ['gemini-2.5-pro'] }
            }
          })
        } as Response)

      const providers = await listGatewayProviders('http://gw-url')

      expect(providers).toEqual([{ id: 'gemini', label: 'Gemini', models: ['gemini-2.5-pro'] }])
      expect(fetch).toHaveBeenNthCalledWith(2, 'http://gw-url/health', expect.any(Object))
    })
  })

  describe('login', () => {
    it('throws error if apiKey is empty', async () => {
      await expect(login('http://s', '')).rejects.toThrow('API key is required')
    })

    it('returns normalized profile on validate success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          identity: {
            id: 'ahmed',
            displayName: 'Ahmed Dev',
            role: 'ADMIN'
          }
        })
      } as Response)

      const profile = await login('http://s', 'sk-test')
      expect(profile).toEqual({
        userId: 'ahmed',
        name: 'Ahmed Dev',
        role: 'admin'
      })
      expect(getStoredApiKey()).toBe('sk-test')
    })

    it('throws error if validation fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Unauthorized key' })
      } as Response)

      await expect(login('http://s', 'sk-bad')).rejects.toThrow('Savant Server rejected this API key')
    })
  })

  describe('loadProfile', () => {
    it('returns null if no apiKey is stored', async () => {
      const profile = await loadProfile('http://s')
      expect(profile).toBeNull()
    })

    it('validates and returns profile if key exists', async () => {
      setStoredApiKey('sk-saved')
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({
          user: {
            username: 'ahmed',
            email: 'ahmed@savant.com'
          }
        })
      } as Response)

      const profile = await loadProfile('http://s')
      expect(profile?.userId).toBe('ahmed')
      expect(profile?.name).toBe('ahmed@savant.com')
    })

    it('clears session and returns null if validation request rejects with 401 or 403 status', async () => {
      setStoredApiKey('sk-saved')
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'unauthorized' })
      } as Response)

      const profile = await loadProfile('http://s')
      expect(profile).toBeNull()
      expect(getStoredApiKey()).toBe('')
    })

    it('retains session and returns offline profile if validation request fails due to connection/server issues', async () => {
      setStoredApiKey('sk-saved')
      vi.mocked(fetch).mockRejectedValueOnce(new Error('connection timeout'))

      const profile = await loadProfile('http://s')
      expect(profile).not.toBeNull()
      expect(profile?.userId).toBe('offline-operator')
      expect(profile?.name).toBe('Operator (Offline)')
      expect(getStoredApiKey()).toBe('sk-saved')
    })
  })

  describe('logout', () => {
    it('clears stored api key', () => {
      setStoredApiKey('sk-saved')
      logout()
      expect(getStoredApiKey()).toBe('')
    })
  })
})
