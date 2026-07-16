import { render, screen, fireEvent } from '@testing-library/react'
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

    // Each funnel stage must have independent selection state even when stages share a legacy content tab.
    fireEvent.click(screen.getByTestId('tab-team'))
    expect(screen.getByTestId('tab-team').className).toContain('active')
    expect(screen.getByTestId('tab-squad').className).not.toContain('active')

    fireEvent.click(screen.getByTestId('tab-squad'))
    expect(screen.getByTestId('tab-squad').className).toContain('active')
    expect(screen.getByTestId('tab-team').className).not.toContain('active')

    fireEvent.click(screen.getByTestId('tab-blueprint'))
    expect(screen.getByTestId('tab-blueprint').className).toContain('active')
    expect(screen.getByTestId('tab-squad').className).not.toContain('active')

  })
})
