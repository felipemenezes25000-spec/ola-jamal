import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '@/api/auth';
import '@/styles/recuperar-verify.css';

type State = 'idle' | 'loading' | 'success' | 'error';

const MIN_PASSWORD_LENGTH = 8;

export default function RecuperarSenha() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const isValidToken = token.trim().length > 0;
  const passwordsMatch = newPassword === confirmPassword;
  const passwordsValid =
    newPassword.length >= MIN_PASSWORD_LENGTH && confirmPassword.length >= MIN_PASSWORD_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidToken || !passwordsValid || !passwordsMatch) return;

    setState('loading');
    setErrorMessage('');

    try {
      await resetPassword(token.trim(), newPassword);
      setState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
      setState('error');
    }
  }

  if (!isValidToken) {
    return (
      <div style={styles.container}>
        <div style={styles.card} className="recuperar-card">
          <h1 style={styles.title}>Redefinir senha</h1>
          <p style={styles.error}>
            O link de redefinição está incompleto ou expirou. Solicite uma nova recuperação de senha
            pelo app.
          </p>
          <Link to="/" style={styles.link}>
            Voltar ao início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card} className="recuperar-card">
        <h1 style={styles.title} className="recuperar-title">
          Nova senha
        </h1>
        <p style={styles.subtitle}>
          Defina uma nova senha com pelo menos {MIN_PASSWORD_LENGTH} caracteres.
        </p>

        {state === 'idle' && (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label htmlFor="new-password" style={styles.label}>
              Nova senha
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={styles.input}
              className="recuperar-input"
              minLength={MIN_PASSWORD_LENGTH}
              aria-label="Nova senha"
            />
            <label htmlFor="confirm-password" style={styles.label}>
              Confirmar senha
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={styles.input}
              className="recuperar-input"
              minLength={MIN_PASSWORD_LENGTH}
              aria-label="Confirmar senha"
            />
            {!passwordsMatch && confirmPassword.length > 0 && (
              <p style={styles.error}>As senhas não coincidem.</p>
            )}
            {newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH && (
              <p style={styles.error}>A senha deve ter pelo menos {MIN_PASSWORD_LENGTH} caracteres.</p>
            )}
            <button
              type="submit"
              disabled={!passwordsValid || !passwordsMatch}
              style={styles.button}
            >
              Redefinir senha
            </button>
          </form>
        )}

        {state === 'loading' && <p style={styles.loading}>Redefinindo senha…</p>}

        {state === 'success' && (
          <div style={styles.success}>
            <p style={styles.successText}>✓ Senha alterada com sucesso!</p>
            <p style={styles.subtitle}>
              Faça login no app com a nova senha.
            </p>
            <Link to="/" style={styles.link}>
              Voltar ao início
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div style={styles.errorBox}>
            <p style={styles.error}>{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setState('idle');
                setErrorMessage('');
              }}
              style={styles.buttonSecondary}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <footer style={styles.footer}>
          <Link to="/cookies" style={styles.footerLink}>
            Política de Cookies
          </Link>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    maxWidth: 420,
    width: '100%',
    background: 'var(--card-bg)',
    borderRadius: 12,
    boxShadow: 'var(--shadow)',
    padding: 32,
  },
  title: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 8,
    marginLeft: 0,
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
  },
  subtitle: {
    marginTop: 0,
    marginRight: 0,
    marginBottom: 24,
    marginLeft: 0,
    color: 'var(--text-secondary)',
    fontSize: 14,
  },
  label: {
    display: 'block',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    padding: 14,
    fontSize: 16,
    border: '1px solid var(--input-border)',
    borderRadius: 8,
    background: 'var(--card-bg)',
    color: 'var(--text)',
  },
  button: {
    padding: 14,
    fontSize: 16,
    fontWeight: 600,
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  buttonSecondary: {
    padding: 10,
    fontSize: 14,
    background: 'var(--border)',
    color: 'var(--text)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 8,
  },
  loading: {
    color: 'var(--text-secondary)',
    margin: 0,
  },
  success: {
    marginBottom: 24,
  },
  successText: {
    color: 'var(--success)',
    fontWeight: 600,
    marginBottom: 16,
  },
  errorBox: {
    marginBottom: 24,
  },
  error: {
    color: 'var(--error)',
    margin: 0,
  },
  link: {
    color: 'var(--primary)',
    textDecoration: 'none',
    fontWeight: 600,
    marginTop: 8,
    display: 'inline-block',
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  footerLink: {
    color: 'var(--primary)',
    textDecoration: 'none',
  },
};
