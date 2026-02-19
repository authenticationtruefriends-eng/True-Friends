import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "danger" // danger, warning, primary
}) {
    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'rgba(239, 68, 68, 0.1)',
            icon: '#ef4444',
            button: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
        },
        warning: {
            bg: 'rgba(245, 158, 11, 0.1)',
            icon: '#f59e0b',
            button: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
        },
        primary: {
            bg: 'rgba(102, 0, 153, 0.1)',
            icon: 'var(--primary)',
            button: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)'
        }
    };

    const color = colors[type] || colors.danger;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                position: 'relative',
                animation: 'scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>

                <button onClick={onClose} style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    border: 'none',
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: '50%',
                    padding: '8px',
                    cursor: 'pointer',
                    color: '#666'
                }}>
                    <X size={18} />
                </button>

                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: color.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px',
                    color: color.icon
                }}>
                    <AlertTriangle size={32} />
                </div>

                <h3 style={{
                    fontSize: '1.4rem',
                    fontWeight: '800',
                    color: '#1a1a1a',
                    marginBottom: '12px',
                    letterSpacing: '-0.02em'
                }}>
                    {title}
                </h3>

                <p style={{
                    color: '#666',
                    lineHeight: '1.6',
                    marginBottom: '32px',
                    fontSize: '1rem'
                }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            flex: 1,
                            padding: '14px',
                            borderRadius: '14px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            background: 'white',
                            color: '#444',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.target.style.background = '#f9f9f9'}
                        onMouseLeave={e => e.target.style.background = 'white'}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => { onConfirm(); onClose(); }}
                        style={{
                            flex: 1,
                            padding: '14px',
                            borderRadius: '14px',
                            border: 'none',
                            background: color.button,
                            color: 'white',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.target.style.transform = 'translateY(0)'}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}
