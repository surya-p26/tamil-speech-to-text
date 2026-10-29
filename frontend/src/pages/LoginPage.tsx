import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  type AuthUser,
  loginUser,
  registerUser,
  googleLoginUser,
  requestPasswordReset,
  confirmPasswordReset,
} from "../api";
import type { GoogleIdentityApi } from "../types";
import { Icon } from "../components/ui/Icons";
import { Card, Badge, Logo } from "../components/ui/UIComponents";

export type LoginMode = "login" | "register" | "forgot" | "reset";

export function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const initialResetToken =
    new URLSearchParams(window.location.search).get("reset_token") ?? "";
  const [mode, setMode] = useState<LoginMode>(
    initialResetToken ? "reset" : "login",
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (initialResetToken) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [initialResetToken]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (mode !== "login" || !clientId || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;

    const initializeGoogle = () => {
      const google = (
        window as Window & { google?: GoogleIdentityApi }
      ).google;

      if (cancelled || !google || !googleButtonRef.current) {
        return;
      }

      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void (async () => {
            clearFeedback();
            setBusy(true);

            try {
              if (!response.credential) {
                throw new Error("Google did not return a sign-in credential.");
              }

              const result = await googleLoginUser(
                response.credential,
                rememberMe,
              );

              onLogin(result.user);
            } catch (loginError) {
              setError(
                loginError instanceof Error
                  ? loginError.message
                  : "Google sign-in failed. Please try again.",
              );
            } finally {
              setBusy(false);
            }
          })();
        },
      });

      googleButtonRef.current.replaceChildren();

      google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: 320,
      });
    };

    const scriptUrl = "https://accounts.google.com/gsi/client";
    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${scriptUrl}"]`,
    );

    if (script && (window as Window & { google?: GoogleIdentityApi }).google) {
      initializeGoogle();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener("load", initializeGoogle);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", initializeGoogle);
    };
  }, [mode, rememberMe, onLogin]);

  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isPasswordForm = mode === "login" || isRegister || isReset;

  const clearFeedback = () => {
    setError("");
    setNotice("");
  };

  const switchMode = (nextMode: LoginMode) => {
    clearFeedback();
    setPassword("");
    setConfirmPassword("");
    setMode(nextMode);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearFeedback();

    if (isRegister && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    if (isPasswordForm && password.length < 10) {
      setError("Use a password with at least 10 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "login") {
        const result = await loginUser(email, password, rememberMe);
        onLogin(result.user);
        return;
      }

      if (mode === "register") {
        const result = await registerUser({
          fullName,
          email,
          department: department || "My department",
          password,
          rememberMe,
        });
        onLogin(result.user);
        return;
      }

      if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        setNotice(result.message);
        return;
      }

      if (!resetToken) {
        setError("This reset link is missing or invalid. Request a new link.");
        return;
      }
      const result = await confirmPasswordReset(resetToken, password);
      setNotice(result.message);
      setResetToken("");
      window.history.replaceState({}, document.title, window.location.pathname);
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === "login"
      ? "Sign in to your workspace"
      : mode === "register"
        ? "Create your workspace account"
        : mode === "forgot"
          ? "Reset your password"
          : "Choose a new password";
  const description =
    mode === "login"
      ? "Use the email and password linked to your workspace."
      : mode === "register"
        ? "Create a personal account to keep your transcription history private."
        : mode === "forgot"
          ? "We’ll send a secure reset link if email recovery is enabled for this server."
          : "Choose a new password for your TamilTranscribe account.";

  return (
    <main className="login-page">
      <section
        className="login-brand"
        aria-label="TamilTranscribe product information"
      >
        <Logo />
        <div className="welcome-copy">
          <Badge tone="blue">
            <Icon name="shield" size={14} /> PRIVATE WORKSPACE
          </Badge>
          <h1>
            Tamil speech.
            <br />
            <span>Officially documented.</span>
          </h1>
          <p>
            Turn Tamil recordings into editable text and formal documents with a
            workflow built for careful review and clear records.
          </p>
          <div className="login-features">
            <div>
              <Icon name="sparkles" />
              <span>
                <b>IndicWhisper AI</b>
                <small>Tamil speech recognition</small>
              </span>
            </div>
            <div>
              <Icon name="shield" />
              <span>
                <b>Personal workspace</b>
                <small>Account-scoped saved records</small>
              </span>
            </div>
            <div>
              <Icon name="file" />
              <span>
                <b>Official formats</b>
                <small>Editable DOCX and PDF</small>
              </span>
            </div>
          </div>
        </div>
        <p className="login-foot">
          தமிழ் குரல் பதிவுகளை உரையாக மாற்றி ஆவணப்படுத்தும் தளம்
        </p>
      </section>

      <section className="login-panel">
        <Card className="login-card">
          <div className="mobile-logo">
            <Logo />
          </div>
          <span className="eyebrow">TAMILTRANSCRIBE WORKSPACE</span>
          <h2>{title}</h2>
          <p>{description}</p>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="auth-alert auth-alert-success" role="status">
              {notice}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            {isRegister && (
              <>
                <label className="auth-field">
                  Full name
                  <input
                    required
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                    maxLength={100}
                  />
                </label>
                <label className="auth-field">
                  Department or organization
                  <input
                    autoComplete="organization"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                    placeholder="e.g. Department of Revenue"
                    maxLength={120}
                  />
                </label>
              </>
            )}

            {!isReset && (
              <label className="auth-field">
                Work email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@department.gov.in"
                  maxLength={254}
                />
              </label>
            )}

            {isPasswordForm && (
              <>
                <label className="auth-field">
                  {isReset ? "New password" : "Password"}
                  <span className="auth-password-wrap">
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        isReset || isRegister
                          ? "new-password"
                          : "current-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        isReset || isRegister
                          ? "At least 10 characters"
                          : "Enter your password"
                      }
                      minLength={10}
                      maxLength={256}
                    />
                    <button
                      type="button"
                      className="auth-show-password"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
                {(isRegister || isReset) && (
                  <label className="auth-field">
                    Confirm password
                    <input
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Enter the password again"
                      minLength={10}
                      maxLength={256}
                    />
                  </label>
                )}
              </>
            )}

            {mode === "login" && (
              <div className="login-options auth-options">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />{" "}
                  Keep me signed in
                </label>
                <button type="button" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
              </div>
            )}

            {isRegister && (
              <div className="auth-password-hint">
                Use at least 10 characters. Your account’s saved transcriptions
                and documents are isolated from other accounts.
              </div>
            )}

            <button
              className="btn btn-primary full-btn auth-submit"
              type="submit"
              disabled={busy}
            >
              <span>
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Sign in securely"
                    : mode === "register"
                      ? "Create account"
                      : mode === "forgot"
                        ? "Send reset link"
                        : "Update password"}
              </span>
              {!busy && !isForgot && !isReset && (
                <Icon name="arrow" size={18} />
              )}
            </button>
          </form>

          {mode === "login" && (
            <>
              <div className="auth-divider">
                <span>OR CONTINUE WITH</span>
              </div>

              {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
                <div
                  className="google-signin-container"
                  ref={googleButtonRef}
                />
              ) : (
                <div className="auth-sso-note">
                  <Icon name="shield" size={17} />
                  <span>
                    <b>Google Sign-In</b>
                    <small>
                      Configure VITE_GOOGLE_CLIENT_ID to enable Google sign-in.
                    </small>
                  </span>
                </div>
              )}
            </>
          )}

          <div className="auth-switch">
            {mode === "login" ? (
              <>
                New to TamilTranscribe?{" "}
                <button type="button" onClick={() => switchMode("register")}>
                  Create an account
                </button>
              </>
            ) : mode === "register" ? (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </>
            ) : (
              <button type="button" onClick={() => switchMode("login")}>
                ← Back to sign in
              </button>
            )}
          </div>
          <div className="security-note">
            <Icon name="shield" size={16} /> Passwords are hashed on the server.
            Sessions expire automatically.
          </div>
        </Card>
        <p className="support-line">
          Need access help? Contact your workspace administrator.
        </p>
      </section>
    </main>
  );
}
