import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'

describe('App', () => {
  it('renders package-provided shell branding', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    window.savantShell = {
      appName: 'Savant Forge',
      appVersion: '1.0.0',
      icon: 'main.svg',
      theme: 'olympus',
      serverUrl: 'http://127.0.0.1:8090',
      gatewayUrl: 'http://127.0.0.1:3100'
    }

    render(<App />)

    expect(screen.getAllByText('FORGE').length).toBeGreaterThan(0)
    expect(screen.getByText('athena chat')).toBeTruthy()
    expect(screen.getByText('blueprints')).toBeTruthy()
    expect(screen.getByText('sync')).toBeTruthy()
  })
})
