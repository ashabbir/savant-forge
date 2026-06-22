import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from '../components/LoginScreen'

describe('LoginScreen', () => {
  it('renders branding elements, placeholder, and inputs', () => {
    render(<LoginScreen onLogin={async () => {}} />)

    expect(screen.getByText('SAVANT FORGE')).toBeTruthy()
    expect(screen.getByText('Authenticate with your Savant API key')).toBeTruthy()
    expect(screen.getByPlaceholderText('sk-...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Validate Key' })).toBeTruthy()
  })

  it('renders validation error when trying to submit empty key', async () => {
    render(<LoginScreen onLogin={async () => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Validate Key' }))

    expect(screen.getByText('Savant API key is required.')).toBeTruthy()
  })

  it('calls onLogin callback on form submit with valid key', async () => {
    const onLogin = vi.fn(() => Promise.resolve())
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-testkey' } })

    fireEvent.click(screen.getByRole('button', { name: 'Validate Key' }))

    expect(onLogin).toHaveBeenCalledWith('sk-testkey')
  })

  it('shows error message if onLogin callback fails', async () => {
    const onLogin = vi.fn(() => Promise.reject(new Error('Invalid token')))
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-bad' } })

    fireEvent.click(screen.getByRole('button', { name: 'Validate Key' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeTruthy()
    })
  })

  it('shows fallback error message if onLogin callback fails without message', async () => {
    const onLogin = vi.fn(() => Promise.reject({}))
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-bad' } })

    fireEvent.click(screen.getByRole('button', { name: 'Validate Key' }))

    await waitFor(() => {
      expect(screen.getByText('Login failed.')).toBeTruthy()
    })
  })
})
