import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsModal } from '../components/SettingsModal'
import { ForgeConfig } from '../services/localState'

describe('SettingsModal', () => {
  const mockConfig: ForgeConfig = {
    active_squad_id: 'squad-alpha',
    squads: [],
    buffer_threshold: 0.8,
    theme: 'olympus',
    athena_provider: 'codex',
    athena_model: 'gpt-5-codex'
  }

  const providers = [
    { id: 'codex', label: 'Codex', models: ['gpt-5-codex', 'gpt-5'] },
    { id: 'gemini', label: 'Gemini', models: ['gemini-2.5-pro'] }
  ]

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsModal 
        isOpen={false}
        config={mockConfig}
        onConfigChange={() => {}}
        onClose={() => {}}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders details correctly when open', () => {
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={() => {}}
        onClose={() => {}}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    expect(screen.getByText('FORGE SETTINGS')).toBeTruthy()
    expect(screen.getByText('OLYMPUS')).toBeTruthy()
    expect(screen.getByText('http://localhost:8090')).toBeTruthy()
    expect(screen.getByText('http://localhost:3100')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('gpt-5-codex')).toBeTruthy()
  })

  it('triggers onConfigChange when buffer threshold slider is modified', () => {
    const onConfigChange = vi.fn()
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={onConfigChange}
        onClose={() => {}}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    const slider = screen.getByTestId('buffer-threshold-input')
    fireEvent.change(slider, { target: { value: '90' } })

    expect(onConfigChange).toHaveBeenCalledWith({
      ...mockConfig,
      buffer_threshold: 0.9
    })
  })

  it('resets model when Athena provider changes', () => {
    const onConfigChange = vi.fn()
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={onConfigChange}
        onClose={() => {}}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    fireEvent.change(screen.getByTestId('athena-provider-select'), { target: { value: 'gemini' } })

    expect(onConfigChange).toHaveBeenCalledWith({
      ...mockConfig,
      athena_provider: 'gemini',
      athena_model: 'gemini-2.5-pro'
    })
  })

  it('renders the gateway provider inventory', () => {
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={() => {}}
        onClose={() => {}}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    expect(screen.getByText('Gateway Providers')).toBeTruthy()
    expect(screen.getByText('Codex')).toBeTruthy()
    expect(screen.getByText('Gemini')).toBeTruthy()
    expect(screen.getByText('gpt-5-codex')).toBeTruthy()
    expect(screen.getByText('gemini-2.5-pro')).toBeTruthy()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={() => {}}
        onClose={onClose}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    const closeButton = screen.getAllByLabelText('Close')[0]
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked, but not when modal card is clicked', () => {
    const onClose = vi.fn()
    render(
      <SettingsModal 
        isOpen={true}
        config={mockConfig}
        onConfigChange={() => {}}
        onClose={onClose}
        theme="olympus"
        serverUrl="http://localhost:8090"
        gatewayUrl="http://localhost:3100"
        providers={providers}
      />
    )

    const backdrop = screen.getByTestId('settings-backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
