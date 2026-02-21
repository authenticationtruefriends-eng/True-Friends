import React, { useState, useEffect, useRef } from 'react';

const SplashAnimation = ({ onComplete }) => {
    const [fadeOut, setFadeOut] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            console.error('❌ SplashAnimation: Video element not found!');
            return;
        }
        console.log('🎬 SplashAnimation mounted!');

        const handleVideoEnd = () => {
            setTimeout(() => {
                setFadeOut(true);
                setTimeout(() => {
                    if (onComplete) onComplete();
                }, 800);
            }, 500);
        };

        video.addEventListener('ended', handleVideoEnd);

        console.log('▶️ Attempting to play video...');
        video.play().then(() => {
            console.log('✅ Video playing successfully!');
        }).catch(err => {
            console.error('❌ Video autoplay failed:', err);
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
    }, [onComplete, fadeOut]);

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
