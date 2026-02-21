import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ChatProvider } from "./context/ChatContext";
import { CallProvider } from "./context/CallContext";
import GlobalCallUI from "./components/chat/GlobalCallUI";
import SplashAnimation from "./components/animation/SplashAnimation";
// ThemeToggle removed - moved to Settings
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPasswordOTP from "./pages/ResetPasswordOTP";
import SetNewPassword from "./pages/SetNewPassword";
import Home from "./pages/Home";
import Welcome from "./pages/Welcome";
import VerifyAccount from "./pages/VerifyAccount";
import FontPreview from "./pages/FontPreview";
import "./App.css";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/welcome" replace state={{ from: location }} />;
  }

  // Define onboarding routes
  const onboardingRoutes = ["/welcome", "/verify"];
  const isCurrentRouteOnboarding = onboardingRoutes.includes(location.pathname);

  // If user is pending verification:
  // 1. Force them to /verify if they are not there.
  // 2. If they ARE at /verify, allow it (do not run further checks).
  if (user.isPending) {
    if (location.pathname !== "/verify") {
      return <Navigate to="/verify" replace />;
    }
    // Allow /verify by falling through to render
  } else {
    // User is NOT pending.

    // If user IS onboarded but tries to access onboarding pages (including /verify), send to Home
    if (user.isOnboarded && isCurrentRouteOnboarding) {
      return <Navigate to="/" replace />;
    }
  }

  return (
    <SocketProvider>
      <ChatProvider>
        <CallProvider>
          <GlobalCallUI />
          {children}
        </CallProvider>
      </ChatProvider>
    </SocketProvider>
  );
}

import ErrorBoundary from "./components/common/ErrorBoundary";

function App() {
  const [showSplash, setShowSplash] = useState(false);

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Listen for login/signup success events
  useEffect(() => {
    const handleLoginSuccess = () => {
      console.log('🎉 App: loginSuccess event received! Showing splash...');
      setShowSplash(true);
    };

    console.log('🎯 App: Setting up loginSuccess event listener');
    window.addEventListener('loginSuccess', handleLoginSuccess);
    return () => window.removeEventListener('loginSuccess', handleLoginSuccess);
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  return (
    <BrowserRouter>
      <ErrorBoundary>
        {showSplash && <SplashAnimation onComplete={handleSplashComplete} />}
        {/* ThemeToggle removed */}
        <Routes>
          {/* Public Routes */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/font-preview" element={<FontPreview />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Password Reset Routes */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
          <Route path="/set-new-password" element={<SetNewPassword />} />

          {/* Onboarding Routes */}
          <Route
            path="/verify"
            element={
              <ProtectedRoute>
                <VerifyAccount />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
