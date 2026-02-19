import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Lock, ArrowRight, Loader2, Check, X } from "lucide-react";

export default function SetNewPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const resetToken = location.state?.resetToken;
    const email = location.state?.email;

    // Password strength validation
    const passwordStrength = {
        hasLength: password.length >= 8,
        hasUpper: /[A-Z]/.test(password),
        hasLower: /[a-z]/.test(password),
        hasNumber: /\d/.test(password),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const isPasswordStrong = Object.values(passwordStrength).every(v => v);

    // Redirect if no reset token
    if (!resetToken) {
        navigate("/forgot-password");
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (!isPasswordStrong) {
            setError("Password does not meet requirements");
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resetToken, newPassword: password })
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                setTimeout(() => {
                    navigate("/login");
                }, 2000);
            } else {
                setError(data.error || "Failed to reset password");
            }
        } catch (err) {
            console.error("Password reset error:", err);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="login-container">
                <div className="animated-bg">
                    <div className="gradient-orb orb-1"></div>
                    <div className="gradient-orb orb-2"></div>
                    <div className="gradient-orb orb-3"></div>
                </div>

                <div className="login-card">
                    <div className="login-header">
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'rgba(34, 197, 94, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1rem'
                        }}>
                            <Check size={48} style={{ color: '#22c55e' }} />
                        </div>
                        <h2>Password Reset Successful!</h2>
                        <p>You can now log in with your new password</p>
                    </div>
                </div>
            </div>
        );
    }

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
                    <h2>Set New Password</h2>
                    <p>Create a strong password for {email}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="input-group">
                        <Lock className="input-icon" size={20} />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* Password Strength Indicator */}
                    {password && (
                        <div style={{
                            padding: '12px',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                                Password Requirements:
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {[
                                    { key: 'hasLength', text: 'At least 8 characters' },
                                    { key: 'hasUpper', text: 'One uppercase letter' },
                                    { key: 'hasLower', text: 'One lowercase letter' },
                                    { key: 'hasNumber', text: 'One number' },
                                    { key: 'hasSpecial', text: 'One special character' }
                                ].map(({ key, text }) => (
                                    <div key={key} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '0.8rem',
                                        color: passwordStrength[key] ? '#22c55e' : 'var(--text-secondary)'
                                    }}>
                                        {passwordStrength[key] ? <Check size={14} /> : <X size={14} />}
                                        {text}
                                    </div>
                                ))}
                            </div>
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
                        disabled={loading || !isPasswordStrong}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Resetting Password...
                            </>
                        ) : (
                            <>
                                Reset Password
                                <ArrowRight size={20} />
                            </>
                        )}
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
        </div>
    );
}
