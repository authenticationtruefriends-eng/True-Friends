import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Map, Shield, ArrowRight } from "lucide-react";

export default function MapIntro() {
    const navigate = useNavigate();
    const { finishOnboarding } = useAuth();
    const [asking, setAsking] = useState(false);

    const handleEnable = () => {
        setAsking(true);
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (_position) => {
                    // Success
                    setAsking(false);
                    finishOnboarding();
                    // Trigger splash animation after onboarding
                    window.dispatchEvent(new Event('loginSuccess'));
                    // Small delay to allow animation to mount
                    setTimeout(() => {
                        navigate("/");
                    }, 100);
                },
                (_error) => {
                    // Error or Denied
                    setAsking(false);
                    finishOnboarding();
                    // Trigger splash animation after onboarding
                    window.dispatchEvent(new Event('loginSuccess'));
                    // Small delay to allow animation to mount
                    setTimeout(() => {
                        navigate("/");
                    }, 100);
                }
            );
        } else {
            finishOnboarding();
            // Trigger splash animation after onboarding
            window.dispatchEvent(new Event('loginSuccess'));
            // Small delay to allow animation to mount
            setTimeout(() => {
                navigate("/");
            }, 100);
        }
    };

    const handleSkip = () => {
        finishOnboarding();
        // Trigger splash animation after onboarding
        window.dispatchEvent(new Event('loginSuccess'));
        // Small delay to allow animation to mount
        setTimeout(() => {
            navigate("/");
        }, 100);
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ textAlign: 'center' }}>
                <div style={{ margin: '1rem auto' }}>
                    <img src="/map-illustration.svg" alt="" style={{ height: '150px', display: 'none' }} />
                    {/* Fallback Icon */}
                    <div style={{
                        width: '120px', height: '120px', background: '#e3f2fd',
                        borderRadius: '50%', margin: '0 auto', display: 'flex',
                        alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Map size={64} color="#2196f3" />
                    </div>
                </div>

                <h2>See who's nearby</h2>
                <p className="subtitle" style={{ maxWidth: '300px', margin: '0 auto 2rem' }}>
                    Enable location to see friends on the map. Your location is encrypted and only shared with friends you choose.
                </p>

                <div style={{
                    background: '#f5f5f5', padding: '12px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    textAlign: 'left', marginBottom: '2rem', fontSize: '0.8rem', color: '#666'
                }}>
                    <Shield size={24} color="#666" />
                    <span>You can disable this at any time in Privacy Settings.</span>
                </div>

                <button onClick={handleEnable} className="login-btn" disabled={asking}>
                    {asking ? "Requesting..." : "Enable Location"}
                </button>

                <button
                    onClick={handleSkip}
                    style={{ width: '100%', background: 'none', border: 'none', color: '#999', marginTop: '1rem', cursor: 'pointer' }}
                >
                    Maybe Later
                </button>
            </div>
        </div>
    );
}
