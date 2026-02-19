import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, MapPin, Check, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function PrivacySetup() {
    const navigate = useNavigate();
    const { finishOnboarding } = useAuth(); // We'll add this to AuthContext

    const [settings, setSettings] = useState({
        lastSeen: true,
        readReceipts: true,
        location: false // Default to OFF as requested
    });

    const handleToggle = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleComplete = () => {
        // In a real app, save 'settings' to backend here
        finishOnboarding(); // Mark as done in context/localstorage
        navigate("/add-friends");
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "var(--bg-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem"
        }}>
            <div style={{
                background: "var(--bg-primary)",
                maxWidth: "500px",
                width: "100%",
                borderRadius: "24px",
                padding: "3rem 2rem",
                boxShadow: "0 20px 40px rgba(0,0,0,0.05)"
            }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                    <div style={{
                        width: "60px", height: "60px", background: "var(--primary-light)",
                        borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 1rem auto", color: "var(--primary-color)"
                    }}>
                        <Lock size={30} />
                    </div>
                    <h2 style={{ fontSize: "1.8rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
                        Your Privacy, Your Rules
                    </h2>
                    <p style={{ color: "var(--text-secondary)" }}>
                        We believe you should control who sees you. Always.
                    </p>
                </div>

                <div className="settings-list" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                    {/* Last Seen */}
                    <PrivacyOption
                        icon={<Eye size={20} />}
                        title="Last Seen"
                        description="Allow friends to see when you were last active."
                        checked={settings.lastSeen}
                        onChange={() => handleToggle("lastSeen")}
                    />

                    {/* Read Receipts */}
                    <PrivacyOption
                        icon={<Check size={20} />}
                        title="Read Receipts"
                        description="Let friends know when you've read their messages."
                        checked={settings.readReceipts}
                        onChange={() => handleToggle("readReceipts")}
                    />

                    {/* Location */}
                    <PrivacyOption
                        icon={<MapPin size={20} />}
                        title="Share Location"
                        description="Share your approximate location (City-level)."
                        checked={settings.location}
                        onChange={() => handleToggle("location")}
                        warning={true} // Visual cue that this is sensitive
                    />

                </div>

                <button
                    className="finish-btn"
                    onClick={handleComplete}
                    style={{
                        marginTop: "3rem",
                        width: "100%",
                        background: "var(--primary-color)",
                        color: "white",
                        border: "none",
                        padding: "16px",
                        borderRadius: "12px",
                        fontSize: "1rem",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px"
                    }}
                >
                    Enter True Friends <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
}

function PrivacyOption({ icon, title, description, checked, onChange, warning }) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "15px",
            padding: "1rem", borderRadius: "12px", border: "1px solid var(--border-color)"
        }}>
            <div style={{ color: "var(--text-secondary)" }}>{icon}</div>
            <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem", color: "var(--text-primary)" }}>{title}</h4>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>{description}</p>
            </div>

            <label className="switch" style={{ position: "relative", display: "inline-block", width: "48px", height: "26px" }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                    position: "absolute", cursor: "pointer",
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: checked ? (warning ? "#ff9f43" : "#4cd137") : "#ccc",
                    transition: ".4s",
                    borderRadius: "34px"
                }}>
                    <span style={{
                        position: "absolute",
                        content: '""',
                        height: "20px", width: "20px",
                        left: checked ? "24px" : "4px", // 4px padding
                        bottom: "3px",
                        backgroundColor: "white",
                        transition: ".4s",
                        borderRadius: "50%"
                    }}></span>
                </span>
            </label>
        </div>
    );
}
