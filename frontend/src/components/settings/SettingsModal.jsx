import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Bell, Moon, Sun, Volume2, Type, Accessibility, Lock, Eye, Check, MapPin } from "lucide-react";

export default function SettingsModal({ onClose }) {
    const [activeTab, setActiveTab] = useState("notifications");
    const [preferences, setPreferences] = useState({
        sound: true,
        vibration: true,
        quietHours: false,
        fontSize: "medium", // small, medium, large
        highContrast: false,
        // Privacy Settings
        lastSeen: true,
        readReceipts: true,
        location: false,
        // Appearance
        darkMode: localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    });

    // Apply visual settings immediately
    useEffect(() => {
        const root = document.documentElement;
        if (preferences.fontSize === 'small') root.style.fontSize = '14px';
        if (preferences.fontSize === 'medium') root.style.fontSize = '16px';
        if (preferences.fontSize === 'large') root.style.fontSize = '18px';

        // Apply Theme
        const theme = preferences.darkMode ? 'dark' : 'light';
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // High contrast would require more CSS variables support, sticking to simple toggle visual for now
    }, [preferences.fontSize, preferences.highContrast, preferences.darkMode]);

    const toggle = (key) => {
        setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const setFontSize = (size) => {
        setPreferences(prev => ({ ...prev, fontSize: size }));
    };

    return createPortal(
        <div className="modal-overlay">
            <div className="settings-modal">
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="settings-body">
                    {/* Sidebar Navigation */}
                    <div className="settings-nav">
                        <button
                            className={activeTab === 'notifications' ? 'active' : ''}
                            onClick={() => setActiveTab('notifications')}
                        >
                            <Bell size={18} /> Notifications
                        </button>
                        <button
                            className={activeTab === 'privacy' ? 'active' : ''}
                            onClick={() => setActiveTab('privacy')}
                        >
                            <Lock size={18} /> Privacy
                        </button>
                        <button
                            className={activeTab === 'appearance' ? 'active' : ''}
                            onClick={() => setActiveTab('appearance')}
                        >
                            <Type size={18} /> Appearance
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="settings-content">
                        {activeTab === 'notifications' && (
                            <div className="settings-section">
                                <h3>Notifications</h3>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Volume2 size={18} />
                                        <div>
                                            <span>Sound</span>
                                            <p>Play sounds for incoming messages</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.sound} onChange={() => toggle('sound')} />
                                </div>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Bell size={18} />
                                        <div>
                                            <span>Vibration</span>
                                            <p>Vibrate on new messages (Mobile only)</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.vibration} onChange={() => toggle('vibration')} />
                                </div>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Moon size={18} />
                                        <div>
                                            <span>Quiet Hours</span>
                                            <p>Mute notifications between 10 PM and 8 AM</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.quietHours} onChange={() => toggle('quietHours')} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'privacy' && (
                            <div className="settings-section">
                                <h3>Privacy & Security</h3>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Eye size={18} />
                                        <div>
                                            <span>Last Seen</span>
                                            <p>Allow friends to see when you were last active.</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.lastSeen} onChange={() => toggle('lastSeen')} />
                                </div>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Check size={18} />
                                        <div>
                                            <span>Read Receipts</span>
                                            <p>Let friends know when you've read their messages.</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.readReceipts} onChange={() => toggle('readReceipts')} />
                                </div>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <MapPin size={18} style={{ color: preferences.location ? '#ff9f43' : 'inherit' }} />
                                        <div>
                                            <span>Share Location</span>
                                            <p>Share your approximate location (City-level).</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.location} onChange={() => toggle('location')} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="settings-section">
                                <h3>Appearance & Accessibility</h3>

                                <div className="setting-box">
                                    <h4>Theme</h4>
                                    <div className="setting-item" style={{ marginBottom: 0 }}>
                                        <div className="setting-label">
                                            <Moon size={18} />
                                            <div>
                                                <span>Dark Mode</span>
                                                <p>Switch between light and dark themes</p>
                                            </div>
                                        </div>
                                        <Toggle checked={preferences.darkMode} onChange={() => toggle('darkMode')} />
                                    </div>
                                </div>

                                <div className="setting-box">
                                    <h4>Font Size</h4>
                                    <div className="font-selector">
                                        <button
                                            className={preferences.fontSize === 'small' ? 'active' : ''}
                                            onClick={() => setFontSize('small')}
                                            style={{ fontSize: '0.8rem' }}
                                        >
                                            A
                                        </button>
                                        <button
                                            className={preferences.fontSize === 'medium' ? 'active' : ''}
                                            onClick={() => setFontSize('medium')}
                                            style={{ fontSize: '1rem' }}
                                        >
                                            A
                                        </button>
                                        <button
                                            className={preferences.fontSize === 'large' ? 'active' : ''}
                                            onClick={() => setFontSize('large')}
                                            style={{ fontSize: '1.2rem' }}
                                        >
                                            A
                                        </button>
                                    </div>
                                    <p className="hint">Adjusts the text size across the entire app.</p>
                                </div>

                                <div className="setting-item">
                                    <div className="setting-label">
                                        <Accessibility size={18} />
                                        <div>
                                            <span>High Contrast</span>
                                            <p>Increase contrast for better readability</p>
                                        </div>
                                    </div>
                                    <Toggle checked={preferences.highContrast} onChange={() => toggle('highContrast')} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function Toggle({ checked, onChange }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
                fontSize: '0.85rem',
                color: checked ? 'var(--primary-color)' : 'var(--text-muted)',
                fontWeight: checked ? '600' : '400',
                minWidth: '24px',
                textAlign: 'right',
                userSelect: 'none',
                cursor: 'pointer'
            }}>
                {checked ? 'On' : 'Off'}
            </span>
            <label className="switch-toggle">
                <input type="checkbox" checked={checked} onChange={onChange} />
                <span className="slider round"></span>
            </label>
        </div>
    );
}
