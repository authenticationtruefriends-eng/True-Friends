import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Monitor, X } from "lucide-react";
import "./Welcome.css";

// ─────────────────────────────────────────────────────────────────────────────
// Antigravity-style particle background
// Observations from https://antigravity.google screenshots:
//   • VERY tiny solid dots (1–4px radius)
//   • Google-brand colors: blue, red, yellow, green
//   • High density (~800 pts) spread evenly across page
//   • Mouse creates a LARGE visible void (~200px radius)
//   • Dots scatter far and snap back fast
// ─────────────────────────────────────────────────────────────────────────────

const COUNT = 800;   // particle count
const RADIUS = 200;   // mouse influence radius (px)
const mouse = { x: -9999, y: -9999 };

// Exactly the colors you see on antigravity.google
const COLORS = [
    '#4285F4', // Google Blue
    '#EA4335', // Google Red
    '#FBBC05', // Google Yellow
    '#34A853', // Google Green
    '#8AB4F8', // Light Blue
    '#F28B82', // Salmon Red
    '#FDD663', // Light Yellow
    '#81C995', // Light Green
];

class Dot {
    constructor(W, H) {
        this.W = W;
        this.H = H;
        this.reset(true);
    }

    reset(init = false) {
        this.bx = Math.random() * this.W;  // base position
        this.by = Math.random() * this.H;
        if (init) {
            this.x = this.bx;
            this.y = this.by;
        }
        this.vx = 0;
        this.vy = 0;

        // Three depth layers — back, mid, front
        this.z = Math.random();   // 0 = back, 1 = front
        const z = this.z;

        // Back dots: tiny (r≈1), dim.  Front dots: bigger (r≈3.5), bright.
        this.r = 0.8 + z * 2.8;
        this.alpha = 0.25 + z * 0.75;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];

        // Very gentle idle drift — barely visible, just alive
        this.dx = (Math.random() - 0.5) * 0.15;
        this.dy = (Math.random() - 0.5) * 0.15;

        // Repulsion strength scales with depth
        this.boost = 10 + z * 45;   // back: slow; front: flies far

        // Spring stiffness scales with depth (front snaps back faster)
        this.k = 0.06 + z * 0.10;
    }

    update() {
        // Drift base position slowly
        this.bx += this.dx;
        this.by += this.dy;
        if (this.bx < 0) this.bx = this.W;
        if (this.bx > this.W) this.bx = 0;
        if (this.by < 0) this.by = this.H;
        if (this.by > this.H) this.by = 0;

        // Vector from mouse → dot
        const ex = this.x - mouse.x;
        const ey = this.y - mouse.y;
        const d2 = ex * ex + ey * ey;
        const d = Math.sqrt(d2);

        if (d < RADIUS && d > 0.5) {
            // Inverse-distance repulsion: strongest up close, fades to zero at RADIUS
            const norm = (RADIUS - d) / RADIUS;          // 1 at centre, 0 at edge
            const force = norm * norm * norm * this.boost; // cubic falloff
            this.vx += (ex / d) * force;
            this.vy += (ey / d) * force;
        }

        // Spring back to base
        this.vx += (this.bx - this.x) * this.k;
        this.vy += (this.by - this.y) * this.k;

        // Damping
        this.vx *= 0.78;
        this.vy *= 0.78;

        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx) {
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        // Dots stretch into motion-blur dashes proportional to speed
        const stretch = 1 + Math.min(7, speed * 0.30);
        const angle = speed > 0.3 ? Math.atan2(this.vy, this.vx) : 0;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(angle);

        // Pill shape: circle when still, elongated dash when moving
        const rw = this.r * stretch;
        const rh = this.r;
        ctx.beginPath();
        ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ─── React Component ──────────────────────────────────────────────────────────

export default function Welcome() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [showSoon, setShowSoon] = useState(false);
    const canvasRef = useRef(null);
    const dotsRef = useRef([]);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");

        const init = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            dotsRef.current = Array.from(
                { length: COUNT },
                () => new Dot(canvas.width, canvas.height)
            );
        };

        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            dotsRef.current.forEach(d => { d.update(); d.draw(ctx); });
            rafRef.current = requestAnimationFrame(animate);
        };

        const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
        const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
        const onResize = () => { init(); };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseleave", onLeave);
        window.addEventListener("resize", onResize);

        init();
        animate();

        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseleave", onLeave);
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    useEffect(() => {
        if (user) navigate(user.isPending ? "/verify" : "/");
    }, [user, navigate]);

    return (
        <div className="welcome-page">
            <canvas ref={canvasRef} className="interactive-bg" />

            {/* Header */}
            <header className="welcome-header">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="brand-name-top"
                >
                    <span className="brand-part-true">True</span>
                    <span className="brand-part-friends"> Friends</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    className="auth-buttons-header"
                >
                    <button onClick={() => navigate("/login")} className="nav-btn login">Login</button>
                    <button onClick={() => navigate("/signup")} className="nav-btn signup">Signup</button>
                </motion.div>
            </header>

            {/* Main */}
            <main className="welcome-main">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="logo-container-large"
                >
                    <img src="/logo.png" alt="True Friends" className="welcome-logo" />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="welcome-tagline"
                >
                    Stay Close, No Matter The Distance
                </motion.h1>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="download-section"
                >
                    <div className="download-btn-group">
                        <button onClick={() => setShowSoon(true)} className="download-btn">
                            <Smartphone size={24} />
                            Download
                        </button>
                        <span className="platform-label">for Android</span>
                    </div>

                    <div className="download-btn-group">
                        <button onClick={() => setShowSoon(true)} className="download-btn">
                            <Monitor size={24} />
                            Download
                        </button>
                        <span className="platform-label">for Windows</span>
                    </div>
                </motion.div>
            </main>

            {/* "Coming Soon" modal */}
            <AnimatePresence>
                {showSoon && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="soon-overlay"
                        onClick={() => setShowSoon(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="soon-modal"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button className="icon-btn" onClick={() => setShowSoon(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <h3>Coming Soon!</h3>
                            <p>We are working hard to launch our official apps. Stay tuned!</p>
                            <button className="close-modal-btn" onClick={() => setShowSoon(false)}>
                                Got it
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
