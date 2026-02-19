import { useState } from "react";
import { jwtDecode } from "jwt-decode";
import { AuthContext } from "./AuthContext";
import { getApiBase } from "../utils/apiConfig";

const API_BASE = getApiBase();
console.log("🔌 AuthProvider using API_BASE:", API_BASE);


export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const storedUser = localStorage.getItem("true_friends_user");
            const pendingUser = localStorage.getItem("true_friends_pending");

            if (storedUser) {
                const parsed = JSON.parse(storedUser);
                if (parsed.uid && parsed.uid.includes(" ")) {
                    parsed.uid = parsed.uid.replace(/\s+/g, '_').toLowerCase();
                }
                if (parsed.email) parsed.email = parsed.email.trim(); // Critical Fix
                localStorage.setItem("true_friends_user", JSON.stringify(parsed));
                return parsed;
            } else if (pendingUser) {
                const parsed = JSON.parse(pendingUser);
                if (parsed.email) parsed.email = parsed.email.trim(); // Critical Fix
                return { ...parsed, isPending: true };
            }
        } catch (e) {
            console.error("Auth init error:", e);
        }
        return null;
    });

    const login = async (username, password) => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success && data.user) {
                localStorage.setItem("true_friends_user", JSON.stringify(data.user));
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.error || "Login failed" };
            }
        } catch (err) {
            console.error("Login Error:", err);
            return { success: false, error: `Login Error: ${err.message}` };
        }
    };

    const signup = async (username, email, password) => {
        try {
            const res = await fetch(`${API_BASE}/api/signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (!data.success) {
                console.error("Signup Failed:", data.error);
                return { success: false, error: data.error };
            }

            const normalizedUid = username.replace(/\s+/g, '_').toLowerCase();
            const pendingUser = {
                uid: normalizedUid,
                displayName: username,
                email: email.trim(), // Critical: Ensure trimmed
                photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username,
                isOnboarded: false,
                isPending: true
            };

            localStorage.setItem("true_friends_pending", JSON.stringify(pendingUser));
            setUser(pendingUser);

            return { success: true };

        } catch (err) {
            console.error("Signup error:", err);
            return { success: false, error: err.message };
        }
    };

    const sendVerificationCode = async (email) => {
        try {
            const res = await fetch(`${API_BASE}/api/resend-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (!data.success) {
                console.error("Failed to send code:", data.error);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Resend error:", err);
            return false;
        }
    };

    const loginWithGoogle = (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);
            const googleUser = {
                uid: decoded.name.replace(/\s+/g, '_').toLowerCase(),
                displayName: decoded.name,
                email: decoded.email,
                photoURL: decoded.picture,
                isOnboarded: true, // Auto-onboard Google users
                isPending: false
            };
            localStorage.setItem("true_friends_user", JSON.stringify(googleUser));
            setUser(googleUser);
        } catch (error) {
            console.error("Google Login Error:", error);
        }
    };

    const verifyAccount = async (code) => {
        if (user && user.isPending) {
            try {
                const res = await fetch(`${API_BASE}/api/verify-otp`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: user.email, otp: code })
                });
                const data = await res.json();

                if (data.success) {
                    const verifiedUser = { ...user, isPending: false };
                    localStorage.removeItem("true_friends_pending");
                    localStorage.setItem("true_friends_user", JSON.stringify(verifiedUser));
                    setUser(verifiedUser);
                    return { success: true };
                } else {
                    console.error("Verification failed:", data.error);
                    return { success: false, error: data.error };
                }
            } catch (err) {
                console.error("Verification error:", err);
                return { success: false, error: `Network Error: ${err.message}` };
            }
        }
        return { success: false, error: "No pending user found" };
    };

    const finishOnboarding = async () => {
        if (user) {
            try {
                // Persist to backend
                await fetch(`${API_BASE}/api/user/complete-onboarding`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user.uid })
                });
            } catch (e) {
                console.error("Onboarding sync error:", e);
            }

            // Always update locally so user isn't blocked
            const updatedUser = { ...user, isOnboarded: true };
            setUser(updatedUser);
            localStorage.setItem("true_friends_user", JSON.stringify(updatedUser));
        }
    };

    const updateUserProfile = (updates) => {
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        localStorage.setItem("true_friends_user", JSON.stringify(updatedUser));
    };

    const logout = () => {
        if (user?.uid) {
            localStorage.removeItem(`true_friends_chats_${user.uid}`);
            localStorage.removeItem(`true_friends_settings_${user.uid}`);
        }
        localStorage.removeItem("true_friends_user");
        localStorage.removeItem("true_friends_pending");
        setUser(null);
    };

    const cancelSignup = async () => {
        if (!user || !user.email) return;
        try {
            await fetch(`${API_BASE}/api/cancel-signup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email })
            });
            // Clear local state regardless of server success to ensure UI resets
            localStorage.removeItem("true_friends_pending");
            localStorage.removeItem("true_friends_user");
            setUser(null);
            return true;
        } catch (err) {
            console.error("Cancel signup error:", err);
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, verifyAccount, sendVerificationCode, logout, finishOnboarding, updateUserProfile, cancelSignup }}>
            {children}
        </AuthContext.Provider>
    );
}
