import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

export default function AudioPlayer({ audioUrl, isMine }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef(null);

    // Generate random waveform heights for visual effect
    const waveformBars = useRef(
        Array.from({ length: 40 }, () => Math.random() * 0.7 + 0.3)
    ).current;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener("timeupdate", updateTime);
        audio.addEventListener("loadedmetadata", updateDuration);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", updateTime);
            audio.removeEventListener("loadedmetadata", updateDuration);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? currentTime / duration : 0;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                background: isMine ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.95)",
                borderRadius: "12px",
                minWidth: "280px",
                maxWidth: "350px",
            }}
        >
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Play/Pause Button */}
            <button
                onClick={togglePlay}
                style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: isMine ? "#ffffff" : "var(--primary)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: isMine ? "var(--primary)" : "#ffffff",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.9)")}
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
                {isPlaying ? (
                    <Pause size={16} fill="currentColor" />
                ) : (
                    <Play size={16} fill="currentColor" style={{ marginLeft: "2px" }} />
                )}
            </button>

            {/* Waveform Visualization */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "2px",
                    height: "32px",
                    cursor: "pointer",
                }}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = x / rect.width;
                    if (audioRef.current && duration) {
                        audioRef.current.currentTime = percentage * duration;
                    }
                }}
            >
                {waveformBars.map((height, index) => {
                    const barProgress = index / waveformBars.length;
                    const isActive = barProgress <= progress;

                    return (
                        <div
                            key={index}
                            style={{
                                flex: 1,
                                height: `${height * 100}%`,
                                background: isActive
                                    ? isMine
                                        ? "#ffffff"
                                        : "var(--primary)"
                                    : isMine
                                        ? "rgba(255,255,255,0.3)"
                                        : "rgba(102, 0, 153, 0.3)",
                                borderRadius: "2px",
                                transition: "all 0.2s",
                                minWidth: "2px",
                            }}
                        />
                    );
                })}
            </div>

            {/* Duration */}
            <div
                style={{
                    fontSize: "0.75rem",
                    color: isMine ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)",
                    fontWeight: "500",
                    minWidth: "35px",
                    textAlign: "right",
                }}
            >
                {formatTime(isPlaying ? currentTime : duration)}
            </div>
        </div>
    );
}
