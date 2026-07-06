import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from '../components/LoginScreen'

describe('LoginScreen', () => {
  it('renders branding elements, placeholder, and inputs', () => {
    render(<LoginScreen onLogin={async () => {}} />)

    expect(screen.getByText('Savant Forge')).toBeTruthy()
    expect(screen.getByText('Authenticate with your Savant API key')).toBeTruthy()
    expect((screen.getByLabelText('Server URL') as HTMLInputElement).value).toBe('http://127.0.0.1:8090')
    expect(screen.getByPlaceholderText('sk-...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'LOGIN' })).toBeTruthy()
  })

  it('focuses the API key input and accepts typing immediately', () => {
    render(<LoginScreen onLogin={async () => {}} />)

    const input = screen.getByLabelText('Savant API Key') as HTMLInputElement
    expect(document.activeElement).toBe(input)

    fireEvent.input(input, { target: { value: 'sk-focused' } })
    expect(input.value).toBe('sk-focused')
  })

  it('renders validation error when trying to submit empty key', async () => {
    render(<LoginScreen onLogin={async () => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }))

    expect(screen.getByText('Savant API key is required.')).toBeTruthy()
  })

  it('calls onLogin callback on form submit with valid key', async () => {
    const onLogin = vi.fn(() => Promise.resolve())
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-testkey' } })

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }))

    expect(onLogin).toHaveBeenCalledWith('sk-testkey', 'http://127.0.0.1:8090')
  })

  it('shows error message if onLogin callback fails', async () => {
    const onLogin = vi.fn(() => Promise.reject(new Error('Invalid token')))
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-bad' } })

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid token')).toBeTruthy()
    })
  })

  it('shows fallback error message if onLogin callback fails without message', async () => {
    const onLogin = vi.fn(() => Promise.reject({}))
    render(<LoginScreen onLogin={onLogin} />)

    const input = screen.getByPlaceholderText('sk-...')
    fireEvent.change(input, { target: { value: 'sk-bad' } })

    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }))

    await waitFor(() => {
      expect(screen.getByText('Login failed.')).toBeTruthy()
    })
  })
})
