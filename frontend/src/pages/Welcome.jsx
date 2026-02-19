import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { MessageCircle, Shield, Globe } from "lucide-react";

export default function Welcome() {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Redirect if already logged in
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

    return (
        <div className="welcome-container">
            <div className="welcome-content">
                <div className="logo-section">
                    <div className="logo-img-container" style={{ width: '120px', height: '120px', margin: '0 auto 1rem' }}>
                        <img src="/logo.jpg" alt="True Friends Logo" className="brand-logo" />
                    </div>
                    <h1 className="brand-name">
                        <span className="brand-part-true">True</span>
                        <span className="brand-part-friends">
                            Friends
                        </span>
                    </h1>
                    <p className="tagline">Connect authentically, anywhere.</p>
                </div>

                <div className="features-preview">
                    <div className="feature-item">
                        <MessageCircle size={20} />
                        <span>Real-time chat & media</span>
                    </div>
                    <div className="feature-item">
                        <Shield size={20} />
                        <span>Privacy-first design</span>
                    </div>
                    <div className="feature-item">
                        <Globe size={20} />
                        <span>Voice & video calls</span>
                    </div>
                </div>

                <div className="welcome-actions">
                    <button onClick={() => navigate("/signup")} className="primary-btn">
                        Create Account
                    </button>
                    <button onClick={() => navigate("/login")} className="secondary-btn">
                        I have an account
                    </button>
                </div>

                <p className="terms">
                    By joining, you agree to our Terms of Service.
                </p>
            </div>
        </div>
    );
}
