import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Lock, ArrowRight, Loader2, RefreshCw } from "lucide-react";

export default function ResetPasswordOTP() {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [attempts, setAttempts] = useState(5);
    const [resendCooldown, setResendCooldown] = useState(30);
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email;

    // Redirect if no email provided
    useEffect(() => {
        if (!email) {
            navigate("/forgot-password");
        }
    }, [email, navigate]);

    // Cooldown timers
    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    // Back Button Interception
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    useEffect(() => {
        window.history.pushState(null, "", window.location.pathname);
        const handlePopState = (event) => {
            event.preventDefault();
            setShowCancelConfirm(true);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    const handleConfirmCancel = async () => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL}/api/cancel-reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
        } catch (e) {
            console.error("Cancel reset error:", e);
        }
        window.location.href = "/login";
    };

    const handleDenyCancel = () => {
        setShowCancelConfirm(false);
        window.history.pushState(null, "", window.location.pathname);
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) value = value[0];
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto-focus next input
        if (value && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        }
        if (e.key === "Enter") {
            handleSubmit(e);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const otpCode = otp.join("");

        if (otpCode.length !== 6) {
            setError("Please enter all 6 digits");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/verify-reset-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: otpCode })
            });

            const data = await res.json();

            if (data.success) {
                // Navigate to set new password page with reset token
                navigate("/set-new-password", {
                    state: { resetToken: data.resetToken, email }
                });
            } else {
                if (res.status === 429) {
                    // Account locked
                    const hours = Math.ceil((new Date(data.lockedUntil) - Date.now()) / (1000 * 60 * 60));
                    setError(`Too many failed attempts. Account locked for ${hours} hours.`);
                    setAttempts(0);
                } else {
                    setError(data.error || "Invalid OTP");
                    setAttempts(data.attemptsRemaining || attempts - 1);
                }
                setOtp(["", "", "", "", "", ""]);
                document.getElementById("otp-0")?.focus();
            }
        } catch (err) {
            console.error("OTP verification error:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;

        setLoading(true);
        setError("");

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/forgot-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (data.success) {
                setResendCooldown(30);
                setAttempts(5);
            } else {
                if (res.status === 429 && data.lockedUntil) {
                    const hours = Math.ceil((new Date(data.lockedUntil) - Date.now()) / (1000 * 60 * 60));
                    setError(`Maximum OTP requests reached. Try again in ${hours} hours.`);
                } else {
                    setError(data.error || "Failed to resend OTP");
                }
            }
        } catch (err) {
            console.error("Resend OTP error:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="animated-bg">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <Lock size={48} style={{ color: 'var(--primary-color)', margin: '0 auto 1rem' }} />
                    <h2>Enter OTP</h2>
                    <p>We sent a 6-digit code to {email}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'center',
                        marginBottom: '1.5rem'
                    }}>
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                id={`otp-${index}`}
                                type="text"
                                inputMode="numeric"
                                maxLength="1"
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                disabled={loading || attempts === 0}
                                style={{
                                    width: '50px',
                                    height: '60px',
                                    textAlign: 'center',
                                    fontSize: '1.5rem',
                                    fontWeight: '600',
                                    border: '2px solid var(--border-color)',
                                    borderRadius: '12px',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    transition: 'all 0.3s ease'
                                }}
                            />
                        ))}
                    </div>

                    {attempts < 5 && attempts > 0 && (
                        <div style={{
                            padding: '12px',
                            background: 'rgba(251, 191, 36, 0.1)',
                            border: '1px solid rgba(251, 191, 36, 0.3)',
                            borderRadius: '8px',
                            color: '#fbbf24',
                            fontSize: '0.9rem',
                            marginBottom: '1rem',
                            textAlign: 'center'
                        }}>
                            {attempts} {attempts === 1 ? 'attempt' : 'attempts'} remaining
                        </div>
                    )}

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

                    <button
                        type="submit"
                        className="login-btn"
                        disabled={loading || attempts === 0}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Verifying...
                            </>
                        ) : (
                            <>
                                Verify OTP
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || loading}
                        style={{
                            marginTop: '1rem',
                            padding: '12px',
                            background: 'transparent',
                            border: '2px solid var(--border-color)',
                            borderRadius: '12px',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                            opacity: resendCooldown > 0 ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <RefreshCw size={18} />
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        <Link to="/login" className="signup-link">
                            Back to Login
                        </Link>
                    </p>
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {showCancelConfirm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    backdropFilter: 'blur(5px)'
                }}>
                    <div style={{
                        background: 'rgba(30,30,30,0.95)', padding: '2rem', borderRadius: '16px',
                        maxWidth: '300px', textAlign: 'center', border: '1px solid #333',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Cancel Reset?</h3>
                        <p style={{ color: '#aaa', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            This will invalidate your OTP and you will need to request a new one.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleDenyCancel}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #444',
                                    background: 'transparent', color: '#fff', cursor: 'pointer'
                                }}
                            >
                                No
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                                    background: '#ff4d4d', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                Yes, Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
