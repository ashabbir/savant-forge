import { useRef, useState } from 'react'
import { AlertTriangle, KeyRound, LogIn } from 'lucide-react'

interface LoginScreenProps {
  onLogin: (apiKey: string, serverUrl?: string) => Promise<void>
  initialServerUrl?: string
}

export function LoginScreen({ onLogin, initialServerUrl }: LoginScreenProps) {
  const apiKeyRef = useRef<HTMLInputElement>(null)
  const serverUrlRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = apiKeyRef.current?.value.trim() || ''
    if (!trimmed) {
      setError('Savant API key is required.')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await onLogin(trimmed, serverUrlRef.current?.value.trim())
    } catch (e: any) {
      setError(e?.message || 'Login failed.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-ambient" aria-hidden="true">
        <div className="login-ambient-cyan" />
        <div className="login-ambient-magenta" />
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-brand">
          <div className="login-mark">
            <img src="./main.svg" alt="" />
          </div>
          <div>
            <h1>Savant Forge</h1>
            <p>Authenticate with your Savant API key</p>
          </div>
        </div>

        <label className="login-label" htmlFor="login-server-url">Server URL</label>
        <div className="login-input-row login-server-row">
          <input
            id="login-server-url"
            ref={serverUrlRef}
            type="text"
            defaultValue={initialServerUrl || 'http://127.0.0.1:8090'}
            placeholder="http://127.0.0.1:8090"
          />
        </div>

        <label className="login-label" htmlFor="login-api-key">Savant API Key</label>
        <div className="login-input-row">
          <KeyRound size={14} />
          <input
            id="login-api-key"
            ref={apiKeyRef}
            type="password"
            onInput={() => {
              if (error) setError('')
            }}
            autoFocus
            placeholder="sk-..."
          />
        </div>

        {error && (
          <div className="login-error">
            <AlertTriangle size={13} />
            <span>{error}</span>
          </div>
        )}

        <button className="login-submit" type="submit" disabled={isSubmitting}>
          <LogIn size={14} />
          {isSubmitting ? 'AUTHENTICATING...' : 'LOGIN'}
        </button>
      </form>
    </div>
  )
}
