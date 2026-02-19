import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { User, Mail, Lock, ArrowRight, AlertCircle, Check, X, Loader2 } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';

export default function Signup() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false); // New state
    const { signup, loginWithGoogle, user } = useAuth();
    const navigate = useNavigate();

    // Redirect if already logged in (e.g., after Google Login)
    useEffect(() => {
        if (user) {
            if (user.isPending) {
                navigate("/verify");
            } else if (!user.isOnboarded) {
                // If verified but not "onboarded" (legacy state), just go home
                navigate("/");
            } else {
                navigate("/");
            }
        }
    }, [user, navigate]);

    // Username Availability State
    const [usernameStatus, setUsernameStatus] = useState(null); // null, 'checking', 'available', 'taken'

    useEffect(() => {
        const checkUsername = async () => {
            if (username.length < 3) {
                setUsernameStatus(null);
                return;
            }
            setUsernameStatus('checking');
            try {
                const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
                const data = await res.json();
                setUsernameStatus(data.available ? 'available' : 'taken');
            } catch {
                setUsernameStatus(null);
            }
        };

        const timer = setTimeout(checkUsername, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [username]);


    // Password Strength Logic
    const getPasswordStrength = (pass) => {
        let strength = 0;
        if (pass.length >= 8) strength += 1;
        if (pass.match(/[A-Z]/)) strength += 1;
        if (pass.match(/[0-9]/)) strength += 1;
        if (pass.match(/[^A-Za-z0-9]/)) strength += 1;
        return strength;
    };

    const strength = getPasswordStrength(password);
    const strengthLabel = ["Weak", "Fair", "Good", "Strong", "Excellent"][strength] || "Weak";
    const strengthColor = ["#ff4d4d", "#ffad33", "#ffad33", "#00cc66", "#00cc66"][strength] || "#ff4d4d";

    const handleSignup = async (e) => {
        e.preventDefault();

        // Request Notification Permission on user interaction
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        console.log("👉 Signup button clicked");
        setError("");

        // Strict Validation
        if (!username || !email || !password) return;

        if (usernameStatus === 'taken') {
            setError("Please choose a different username.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        if (strength < 2) {
            setError("Please choose a stronger password (mix of letters & numbers).");
            return;
        }

        setIsLoading(true); // Start loading

        try {
            // Call Signup with Password
            console.log("🚀 Calling API...");
            const result = await signup(username.trim(), email.trim(), password);
            console.log("✅ API Result:", result);

            if (result.success) {
                navigate("/verify");
            } else {
                setError(result.error || "Signup failed. Please try again.");
            }
        } catch (err) {
            console.error("Signup Crash:", err);
            setError("Something went wrong. Check console.");
        } finally {
            setIsLoading(false); // Stop loading
        }
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: '400px' }}>
                <div className="login-header">
                    <div
                        className="logo-img-container"
                        style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem auto', cursor: 'pointer', userSelect: 'none' }}
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
                        <img src="/logo.jpg" alt="True Friends Logo" className="brand-logo" />
                    </div>
                    <h2 className="brand-name">
                        <span className="brand-part-true">True</span>
                        <span className="brand-part-friends">
                            Friends
                        </span>
                    </h2>
                    <p>Join the community and start connecting</p>
                </div>

                <form onSubmit={handleSignup} className="login-form">
                    {/* Error Message UI */}
                    {error && (
                        <div style={{
                            background: 'rgba(255, 77, 77, 0.1)',
                            border: '1px solid rgba(255, 77, 77, 0.3)',
                            color: '#ff4d4d',
                            padding: '12px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9rem',
                            marginBottom: '10px',
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}
                    <div className="input-group">
                        <div className="input-icon">
                            <Mail size={20} />
                        </div>
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group" style={{
                        borderColor: usernameStatus === 'taken' ? '#ff4d4d' : usernameStatus === 'available' ? '#4ade80' : '',
                        borderWidth: usernameStatus ? '1px' : '',
                        background: 'var(--bg-secondary)'
                    }}>
                        <div className="input-icon">
                            <User size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                            {usernameStatus === 'checking' && <Loader2 size={18} className="spin" style={{ color: '#999' }} />}
                            {usernameStatus === 'available' && <Check size={18} color="#4ade80" />}
                            {usernameStatus === 'taken' && <X size={18} color="#ff4d4d" />}
                        </div>
                    </div>
                    {usernameStatus === 'taken' && (
                        <div style={{ color: '#ff4d4d', fontSize: '0.8rem', marginTop: '-12px', marginBottom: '12px', paddingLeft: '4px' }}>
                            Username is already taken
                        </div>
                    )}
                    <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                    <div className="input-group">
                        <div className="input-icon">
                            <Lock size={20} />
                        </div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {/* Password Strength Meter */}
                    {password && (
                        <div style={{ marginTop: '-10px', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', gap: '4px', height: '4px', marginBottom: '4px' }}>
                                {[1, 2, 3, 4].map((level) => (
                                    <div
                                        key={level}
                                        style={{
                                            flex: 1,
                                            background: strength >= level ? strengthColor : '#eee',
                                            borderRadius: '2px',
                                            transition: 'all 0.3s'
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: '#666' }}>Strength:</span>
                                <span style={{ color: strengthColor, fontWeight: 'bold' }}>{strengthLabel}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={isLoading || !username || !email || !password || strength < 2 || usernameStatus === 'taken'}
                        style={{ opacity: (isLoading || !username || !email || !password || strength < 2 || usernameStatus === 'taken') ? 0.6 : 1, cursor: isLoading ? 'wait' : 'pointer' }}
                    >
                        {isLoading ? "Signing Up..." : "Sign Up"} {!isLoading && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
                    </button>
                    {(!username || !email || !password || strength < 2) && (
                        <p style={{ fontSize: '0.8rem', color: '#999', textAlign: 'center', marginTop: '10px' }}>
                            {!username || !email || !password ? "Please fill in all fields" : (strength < 2 ? "Password too weak" : "")}
                        </p>
                    )}
                </form>

                <div className="login-footer">
                    <p>Already have an account? <Link to="/login">Log In</Link></p>
                </div>

                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '1px', background: '#eee' }}></div>
                    <span style={{ fontSize: '0.8rem', color: '#999' }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: '#eee' }}></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GoogleLogin
                        onSuccess={loginWithGoogle}
                        onError={() => {
                            console.log('Signup Failed');
                        }}
                        useOneTap={false}
                        text="signup_with"
                        size="large"
                        width="320"
                    />
                </div>
            </div>
        </div >
    );
}
