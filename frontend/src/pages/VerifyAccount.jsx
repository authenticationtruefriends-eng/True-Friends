import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, ArrowRight } from "lucide-react";

export default function VerifyAccount() {
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [error, setError] = useState("");
    const [isResending, setIsResending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false); // New state
    const [resendStatus, setResendStatus] = useState(""); // "Sent!" or error
    const inputRefs = useRef([]);
    const { verifyAccount, sendVerificationCode, user, finishOnboarding, cancelSignup } = useAuth();
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    // Intercept Back Button
    useEffect(() => {
        // Push state to trap the back button
        window.history.pushState(null, "", window.location.pathname);

        const handlePopState = (event) => {
            // Prevent default back navigation
            event.preventDefault();
            // Show custom confirmation
            setShowCancelConfirm(true);
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    const handleConfirmCancel = async () => {
        await cancelSignup();
        // Determine where to go (Likely Signup or Home)
        window.location.href = "/signup";
    };

    const handleDenyCancel = () => {
        setShowCancelConfirm(false);
        // Push state again to re-trap
        window.history.pushState(null, "", window.location.pathname);
    };

    useEffect(() => {
        // Focus first input
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (index, value) => {
        if (isNaN(value)) return;
        setError(""); // Clear error on type
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto-advance
        if (value !== "" && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            inputRefs.current[index - 1].focus();
        }
        if (e.key === "Enter") {
            handleVerify();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join("");
        if (fullCode.length === 6 && !isVerifying) {
            setError("");
            setIsVerifying(true);
            try {
                const result = await verifyAccount(fullCode);
                if (result.success) {
                    // Trigger splash animation FIRST
                    window.dispatchEvent(new Event('loginSuccess'));

                    // Small delay to allow App to render Splash before we change routes/state
                    setTimeout(() => {
                        // Complete onboarding - this will trigger ProtectedRoute to auto-redirect to "/"
                        finishOnboarding();
                    }, 50);
                } else {
                    setError(result.error || "Invalid or expired code.");
                    setCode(["", "", "", "", "", ""]); // Reset
                    inputRefs.current[0]?.focus();
                }
            } finally {
                setIsVerifying(false);
            }
        }
    };

    const handleResend = async () => {
        if (!user?.email || isResending) return;
        setIsResending(true);
        setResendStatus("");

        const success = await sendVerificationCode(user.email);

        setIsResending(false);
        if (success) {
            setResendStatus("Code sent! Check your email.");
            setTimeout(() => setResendStatus(""), 3000);
        } else {
            setError("Failed to send code. Session may have expired. Please Signup again.");
            setResendStatus("");
        }
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ textAlign: 'center' }}>
                <div style={{
                    background: '#e8f5e9', width: '60px', height: '60px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 1.5rem'
                }}>
                    <ShieldCheck size={32} color="#43a047" />
                </div>

                <h2>Verify your Account</h2>
                <p style={{ color: '#666', marginBottom: '2rem' }}>
                    We sent a code to your email. <br /> Enter it below to verify your identity.
                </p>

                {error && (
                    <div style={{
                        color: '#ff4d4d',
                        background: 'rgba(255, 77, 77, 0.1)',
                        padding: '10px',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem' }}>
                    {code.map((digit, index) => (
                        <input
                            key={index}
                            ref={el => inputRefs.current[index] = el}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            style={{
                                width: '40px', height: '50px', fontSize: '1.2rem',
                                textAlign: 'center', border: `1px solid ${error ? '#ff4d4d' : '#ddd'}`,
                                borderRadius: '8px', outline: 'none',
                                transition: 'border-color 0.3s'
                            }}
                        />
                    ))}
                </div>

                <button
                    onClick={handleVerify}
                    className="login-btn"
                    disabled={isVerifying || code.join("").length < 6}
                    style={{ opacity: (isVerifying || code.join("").length < 6) ? 0.6 : 1, cursor: isVerifying ? 'wait' : 'pointer' }}
                >
                    {isVerifying ? "Verifying..." : "Verify"} {!isVerifying && <ArrowRight size={18} style={{ marginLeft: '8px' }} />}
                </button>

                <div style={{ marginTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>
                        Didn't receive the code?
                    </p>
                    <button
                        onClick={handleResend}
                        disabled={isResending}
                        style={{
                            background: 'none', border: 'none', color: isResending ? '#999' : 'var(--primary)',
                            fontWeight: '600', cursor: isResending ? 'default' : 'pointer', marginTop: '5px'
                        }}
                    >
                        {isResending ? "Sending..." : "Resend Code"}
                    </button>
                    {resendStatus && (
                        <p style={{ fontSize: '0.8rem', color: '#43a047', marginTop: '5px' }}>
                            {resendStatus}
                        </p>
                    )}
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
                        <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Cancel Verification?</h3>
                        <p style={{ color: '#aaa', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Going back will verify cancel and invalidate your code. You will need to sign up again.
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleDenyCancel}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #444',
                                    background: 'transparent', color: '#fff', cursor: 'pointer'
                                }}
                            >
                                No, Stay
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
