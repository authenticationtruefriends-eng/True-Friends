import React, { useState, useEffect, useRef } from 'react';

const SplashAnimation = ({ onComplete }) => {
    const [fadeOut, setFadeOut] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleVideoEnd = () => {
            setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 800);
            }, 500);
        };

        video.addEventListener('ended', handleVideoEnd);

        video.play().catch(err => {
            console.error('Video autoplay failed:', err);
        });

        // Safety Fallback: Ensure splash always dismisses
        const safetyTimer = setTimeout(() => {
            if (!fadeOut) {
                console.warn("Splash video timed out, forcing dismiss.");
                setFadeOut(true);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 800);
            }
        }, 4000); // 4 seconds max

        return () => {
            video.removeEventListener('ended', handleVideoEnd);
            clearTimeout(safetyTimer);
        };
    }, [onComplete]);

    return (
        <div className={`splash-animation-overlay ${fadeOut ? 'fade-out' : ''}`}>
            <div className="splash-animation-content">
                <video
                    ref={videoRef}
                    className="splash-animation-video"
                    muted
                    playsInline
                    autoPlay
                >
                    <source src="/animation.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    );
};

export default SplashAnimation;
