import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getConstructedUrl, isExternalUrl } from "../../utils/urlHelper";

export default function ImageModal({ imageUrl, onClose }) {
    const [zoom, setZoom] = useState(1);

    // Prevent body scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Add event listener for Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleDownload = async () => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            // Fallback
            const link = document.createElement('a');
            link.href = imageUrl;
            link.target = '_blank';
            link.download = `image-${Date.now()}.png`;
            link.click();
        }
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev + 0.25, 3));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev - 0.25, 0.5));
    };

    const modalContent = (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(15, 23, 42, 0.95)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
            }}
            onClick={onClose}
        >
            {/* Header Controls */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
                    zIndex: 100000
                }}
            >
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                        className="modal-icon-btn"
                        title="Zoom Out"
                    >
                        <ZoomOut size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                        className="modal-icon-btn"
                        title="Zoom In"
                    >
                        <ZoomIn size={20} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                        className="modal-icon-btn"
                        title="Download"
                    >
                        <Download size={20} />
                    </button>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="modal-icon-btn close-btn-modern"
                    title="Close (ESC)"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Image Container */}
            <div
                style={{
                    maxWidth: '95vw',
                    maxHeight: '92vh',
                    overflow: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animation: 'scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={getConstructedUrl(imageUrl)}
                    alt="Full size preview"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '92vh',
                        objectFit: 'contain',
                        transform: `scale(${zoom})`,
                        transition: 'transform 0.2s ease-out',
                        cursor: zoom > 1 ? 'move' : 'default',
                        borderRadius: '12px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        display: 'block'
                    }}
                    draggable={false}
                />
            </div>

            {/* Zoom Level Indicator */}
            <div
                style={{
                    position: 'absolute',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '30px',
                    fontSize: '1rem',
                    fontWeight: '700',
                    pointerEvents: 'none',
                    letterSpacing: '1px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                }}
            >
                {Math.round(zoom * 100)}%
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                
                .modal-icon-btn {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 14px;
                    padding: 12px;
                    cursor: pointer;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                .modal-icon-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                .close-btn-modern {
                    background: rgba(239, 68, 68, 0.2);
                    border-color: rgba(239, 68, 68, 0.3);
                }
                .close-btn-modern:hover {
                    background: rgba(239, 68, 68, 0.4);
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
}
