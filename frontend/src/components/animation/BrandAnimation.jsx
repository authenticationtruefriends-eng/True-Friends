import React, { useState, useEffect, useRef } from 'react';

const BrandAnimation = ({ totalFrames = 56, frameRate = 107, onComplete }) => {
    const [currentFrame, setCurrentFrame] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const intervalRef = useRef(null);

    // Preload all images
    useEffect(() => {
        const images = [];
        let loadedCount = 0;

        for (let i = 1; i <= totalFrames; i++) {
            const img = new Image();
            const frameNumber = String(i).padStart(3, '0');
            img.src = `/src/assets/animation/frame-${frameNumber}.jpg`;

            img.onload = () => {
                loadedCount++;
                if (loadedCount === totalFrames) {
                    setIsLoading(false);
                }
            };

            img.onerror = () => {
                console.error(`Failed to load frame ${i}`);
                loadedCount++;
                if (loadedCount === totalFrames) {
                    setIsLoading(false);
                }
            };

            images.push(img);
        }

        return () => {
            images.forEach(img => {
                img.onload = null;
                img.onerror = null;
            });
        };
    }, [totalFrames]);

    // Play animation
    useEffect(() => {
        if (isLoading) return;

        intervalRef.current = setInterval(() => {
            setCurrentFrame(prev => {
                if (prev >= totalFrames) {
                    clearInterval(intervalRef.current);
                    if (onComplete) onComplete();
                    return totalFrames; // Hold on last frame
                }
                return prev + 1;
            });
        }, frameRate);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isLoading, totalFrames, frameRate, onComplete]);

    const frameNumber = String(currentFrame).padStart(3, '0');
    const frameSrc = `/src/assets/animation/frame-${frameNumber}.jpg`;

    return (
        <div className="brand-animation-container">
            {isLoading ? (
                <div className="brand-animation-loading">
                    <div className="loading-spinner"></div>
                </div>
            ) : (
                <img
                    src={frameSrc}
                    alt="True Friends Animation"
                    className="brand-animation-frame"
                />
            )}
        </div>
    );
};

export default BrandAnimation;
