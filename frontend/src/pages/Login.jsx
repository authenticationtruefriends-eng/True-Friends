import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, ArrowRight, User, AlertCircle, X } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';

export default function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState(""); // Changed from boolean loginError
    const { login, loginWithGoogle, user } = useAuth();
    const navigate = useNavigate();
    const [isLoggingIn, setIsLoggingIn] = useState(false);


    // Redirect if already logged in (but skipped if we are currently handling the login manually)
    useEffect(() => {
        if (user && !isLoggingIn) {
            if (user.isPending) {
                navigate("/verify");
            } else if (!user.isOnboarded) {
                // If verified but not "onboarded" (legacy state), just go home
                navigate("/");
            } else {
                navigate("/");
            }
        }
    }, [user, navigate, isLoggingIn]);

    const handleLogin = async (e) => {
        e.preventDefault();

        // Request Notification Permission on user interaction
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        if (username && password) {
            setIsLoggingIn(true); // Block useEffect redirect
            const result = await login(username, password);
            if (result.success) {
                setErrorMessage("");
                console.log('🎉 Login: loginSuccess event dispatched!');
                window.dispatchEvent(new Event('loginSuccess'));
                // Increased delay to allow animation to mount before navigation
                setTimeout(() => {
                    navigate("/");
                }, 300);
            } else {
                setIsLoggingIn(false); // Re-enable useEffect checks (and allow retry)
                setErrorMessage(result.error || "Login failed. Please check your credentials.");
                // Remove alert()
            }
        }
    };

    const handleGoogleSuccess = (credentialResponse) => {
        setIsLoggingIn(true);
        loginWithGoogle(credentialResponse);
        console.log('🎉 Google Login: loginSuccess event dispatched!');
        window.dispatchEvent(new Event('loginSuccess'));
        setTimeout(() => {
            navigate("/");
        }, 300);
    };

    return (
        <div className="login-container">
            {/* Animated Mesh Gradient Background */}
            <div className="animated-bg">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div
                        className="logo-container"
                        style={{ background: 'transparent', boxShadow: 'none', cursor: 'pointer', userSelect: 'none' }}
                        onClick={(e) => {
                            if (e.detail === 3) { // Triple-click
                                const current = localStorage.getItem("custom_api_url") || "";
                                const url = prompt("🔧 Server Settings\n\nEnter Backend URL (e.g. https://your-tunnel.loca.lt):", current);
                                if (url !== null) {
                                    if (!url) {
                                        localStorage.removeItem("custom_api_url");
                                    } else {
                                        localStorage.setItem("custom_api_url", url.trim().replace(/\/$/, ""));
                                    }
                                    window.location.reload();
                                }
                            }
                        }}
                    >
                        <div className="logo-img-container" style={{ width: '100px', height: '100px', margin: '0 auto' }}>
                            <img src="/logo.jpg" alt="True Friends Logo" className="brand-logo" />
                        </div>
                    </div>
                    <h2 className="brand-name" style={{ fontSize: '1.8rem' }}>
                        <span className="brand-part-true">True</span>
                        <span className="brand-part-friends">
                            Friends
                        </span>
                    </h2>
                    <p>Welcome back! Please login to continue.</p>
                </div>

                <form onSubmit={handleLogin} className="login-form">
                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="error-banner">
                            <div className="error-icon">
                                <AlertCircle size={20} />
                            </div>
                            <div className="error-content">
                                <span>{errorMessage}</span>
                            </div>
                            <button type="button" onClick={() => setErrorMessage("")} className="error-close">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    <style>{`
                        .error-banner {
                            background: rgba(255, 59, 48, 0.1);
                            border: 1px solid rgba(255, 59, 48, 0.2);
                            border-left: 4px solid #ff3b30;
                            border-radius: 12px;
                            padding: 12px 16px;
                            margin-bottom: 20px;
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            color: #ff3b30;
                            font-size: 0.9rem;
                            animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                            backdrop-filter: blur(10px);
                            box-shadow: 0 4px 12px rgba(255, 59, 48, 0.1);
                        }
                        .error-icon {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                        }
                        .error-content {
                            flex: 1;
                            font-weight: 500;
                        }
                        .error-close {
                            background: none;
                            border: none;
                            color: rgba(255, 59, 48, 0.6);
                            cursor: pointer;
                            padding: 4px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: all 0.2s;
                        }
                        .error-close:hover {
                            background: rgba(255, 59, 48, 0.1);
                            color: #ff3b30;
                        }
                        @keyframes shake {
                            10%, 90% { transform: translate3d(-1px, 0, 0); }
                            20%, 80% { transform: translate3d(2px, 0, 0); }
                            30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                            40%, 60% { transform: translate3d(4px, 0, 0); }
                        }
                    `}</style>

                    <div className="input-group">
                        <div className="input-icon">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username or Email"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setErrorMessage(""); // Clear error on typing
                            }}
                            required
                        />
                        <div className="input-border"></div>
                    </div>

                    <div className="input-group">
                        <div className="input-icon">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setErrorMessage(""); // Clear error on typing
                            }}
                            required
                        />
                        <div className="input-border"></div>
                    </div>

                    {/* Forgot Password Link */}
                    <div style={{ textAlign: 'right', marginBottom: '1rem' }}>
                        <Link
                            to="/forgot-password"
                            style={{
                                fontSize: '0.9rem',
                                color: errorMessage ? '#ff3b30' : 'var(--text-secondary)',
                                textDecoration: 'none',
                                fontWeight: errorMessage ? '600' : '400',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            Forgot Password?
                        </Link>
                    </div>

                    <button type="submit" className="login-btn">
                        <span>Login</span>
                        <ArrowRight size={18} className="btn-icon" />
                        <div className="btn-glow"></div>
                    </button>
                </form>

                <div className="divider">
                    <div className="divider-line"></div>
                    <span className="divider-text">OR</span>
                    <div className="divider-line"></div>
                </div>

                <div className="google-login-container">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => console.log('Login Failed')}
                        useOneTap={true}
                        text="signin_with"
                        size="large"
                        width="320"
                    />
                </div>

                <div className="login-footer">
                    <p>Don't have an account? <Link to="/signup" className="signup-link">Sign Up</Link></p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginTop: '1rem' }}>
                        <button
                            onClick={() => {
                                const current = localStorage.getItem("custom_api_url") || "";
                                const url = prompt("Enter Backend URL (e.g. from ngrok/localtunnel):", current);
                                if (url !== null) {
                                    import("../utils/apiConfig").then(module => module.setApiBase(url));
                                }
                            }}
                            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Server Settings
                        </button>
                        <span style={{ fontSize: '0.7rem', color: '#666' }}>
                            Connecting to: {localStorage.getItem("custom_api_url") || "Default (Localhost)"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
