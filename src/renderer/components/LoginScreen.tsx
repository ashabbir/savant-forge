import { useState } from "react";
import { KeyRound, X, Check, AlertTriangle } from "lucide-react";

interface LoginScreenProps {
  onLogin: (apiKey: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setError("Savant API key is required.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onLogin(trimmed);
    } catch (e: any) {
      setError(e?.message || "Login failed.");
      setIsSubmitting(false);
    }
  }

  function handleClear() {
    setApiKey("");
    setError("");
  }

  return (
    <div className="modal-backdrop" data-testid="login-backdrop">
      <div 
        className="modal-card flex flex-col gap-4" 
        style={{ maxWidth: '460px', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-head border-b border-[var(--cp-border)] pb-3" style={{ borderBottom: '1px solid var(--cp-border)', paddingBottom: '8px', marginBottom: '12px' }}>
          <div>
            <div className="eyebrow">Access Control</div>
            <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--cp-cyan)', fontFamily: "'Orbitron', sans-serif" }} className="tracking-widest uppercase">
              Operator Login
            </h2>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--cp-bg-2)', border: '1px solid var(--cp-border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", color: 'var(--cp-cyan)', fontSize: '11px' }}>
              // Savant Authentication Portal
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>Savant API Key</label>
              <div
                style={{ background: "var(--cp-bg-3)", border: "1px solid var(--cp-border)", display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}
              >
                <KeyRound size={14} style={{ color: "var(--cp-cyan)", opacity: 0.7 }} />
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  autoFocus
                  placeholder="sk-..."
                  style={{
                    background: "transparent",
                    color: "var(--foreground)",
                    fontFamily: "'Share Tech Mono', monospace",
                    outline: "none",
                    border: "none",
                    width: "100%",
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {error && (
              <div
                style={{ color: "var(--cp-magenta)", fontFamily: "'Share Tech Mono', monospace", display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', marginTop: '4px' }}
              >
                <AlertTriangle size={13} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Modal Footer with X and ✅ icons only */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--cp-border)' }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '10px', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {isSubmitting ? 'Authenticating...' : 'Enter API Key to enter Forge'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {/* Clear / X Icon Button */}
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear Key"
                title="Clear Key"
                disabled={isSubmitting}
                style={{ background: 'transparent', border: '1px solid rgba(255, 0, 170, 0.35)', color: 'var(--cp-magenta)', width: '28px', height: '28px', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
              >
                <X size={14} />
              </button>
              {/* Login / ✅ Icon Button */}
              <button
                type="submit"
                aria-label="Validate Key"
                title="Validate Key"
                disabled={isSubmitting}
                style={{ background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.35)', color: 'var(--cp-green)', width: '28px', height: '28px', display: 'grid', placeItems: 'center', cursor: 'pointer', opacity: isSubmitting ? 0.5 : 1 }}
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
