import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowRight, Loader2 } from "lucide-react";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const navigate = useNavigate();

    // Cooldown timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (data.success) {
                setMessage("OTP sent to your email. Please check your inbox.");
                setCooldown(30); // 30-second cooldown
                // Navigate to OTP verification page after 2 seconds
                setTimeout(() => {
                    navigate("/reset-password-otp", { state: { email } });
                }, 2000);
            } else {
                if (res.status === 429) {
                    // Rate limit exceeded
                    if (data.lockedUntil) {
                        const hours = Math.ceil((new Date(data.lockedUntil) - Date.now()) / (1000 * 60 * 60));
                        setError(`Maximum OTP requests reached. Try again in ${hours} hours.`);
                    } else if (data.retryAfter) {
                        setCooldown(data.retryAfter);
                        setError(`Please wait ${data.retryAfter} seconds before requesting another OTP.`);
                    }
                } else {
                    setError(data.error || "Failed to send OTP. Please try again.");
                }
            }
        } catch (err) {
            console.error("Forgot password error:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
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
                    <h2>Forgot Password?</h2>
                    <p>Enter your email to receive a password reset OTP</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <Mail className="input-icon" size={20} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading || cooldown > 0}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '0.9rem',
                            marginBottom: '1rem'
                        }}>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '8px',
                            color: '#22c55e',
                            fontSize: '0.9rem',
                            marginBottom: '1rem'
                        }}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || cooldown > 0}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Sending OTP...
                            </>
                        ) : cooldown > 0 ? (
                            <>Wait {cooldown}s</>
                        ) : (
                            <>
                                Send OTP
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        Remember your password?{" "}
                        <Link to="/login" className="signup-link">
                            Log In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
