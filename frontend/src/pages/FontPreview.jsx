import React from 'react';
import { PawPrint } from 'lucide-react';

export default function FontPreview() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
    const numbers = "0123456789".split("");

    return (
        <div style={{ padding: '40px', background: '#f5f5f5', minHeight: '100vh', fontFamily: "'Fredoka', sans-serif" }}>
            <h1 style={{ textAlign: 'center', marginBottom: '40px' }}>Brand Font Preview (Fredoka)</h1>

            <div style={{ background: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', maxWidth: '1000px', margin: '0 auto' }}>

                {/* Official Logo */}
                <div style={{ marginBottom: '40px', textAlign: 'center' }}>
                    <h3 style={{ color: '#999', marginBottom: '10px', fontSize: '1rem', fontWeight: 'normal' }}>Official Logo Construction</h3>
                    <h1 className="brand-name" style={{ fontSize: '3rem', justifyContent: 'center' }}>
                        <span className="brand-part-true">True</span>
                        <span className="brand-part-friends">
                            Fr
                            <span className="brand-paw-container">
                                ı
                                <PawPrint className="brand-paw-icon" fill="currentColor" />
                            </span>
                            ends
                        </span>
                    </h1>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>

                    {/* Primary Brand Color (True) */}
                    <div>
                        <h3 style={{ color: '#666', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                            Primary Color Style ("True")
                            <span style={{ display: 'block', fontSize: '0.8rem', color: '#999', marginTop: '5px' }}>Deep Teal (#1a4f6e)</span>
                        </h3>
                        <div className="brand-part-true" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', wordBreak: 'break-all' }}>
                            {alphabet.join(" ")}
                        </div>
                        <div className="brand-part-true" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', marginTop: '20px', wordBreak: 'break-all' }}>
                            {lowercase.join(" ")}
                        </div>
                        <div className="brand-part-true" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', marginTop: '20px' }}>
                            {numbers.join(" ")}
                        </div>
                    </div>

                    {/* Gradient Style (Friends) */}
                    <div>
                        <h3 style={{ color: '#666', marginBottom: '20px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
                            Gradient Style ("Friends")
                            <span style={{ display: 'block', fontSize: '0.8rem', color: '#999', marginTop: '5px' }}>Orange Gradient</span>
                        </h3>
                        <div className="brand-part-friends" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', wordBreak: 'break-all', display: 'block' }}>
                            {alphabet.join(" ")}
                        </div>
                        <div className="brand-part-friends" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', marginTop: '20px', wordBreak: 'break-all', display: 'block' }}>
                            {lowercase.join(" ")}
                        </div>
                        <div className="brand-part-friends" style={{ fontSize: '2rem', fontWeight: '700', lineHeight: '1.5', marginTop: '20px', display: 'block' }}>
                            {numbers.join(" ")}
                        </div>
                    </div>
                </div>

                {/* Paw Integration Test */}
                <div style={{ marginTop: '50px', paddingTop: '30px', borderTop: '2px solid #eee' }}>
                    <h3 style={{ color: '#666', marginBottom: '20px' }}>Letter 'i' with Paw Icon (Custom Construction)</h3>
                    <div style={{ display: 'flex', gap: '30px', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="brand-part-true" style={{ fontSize: '4rem', fontWeight: '700', display: 'flex', alignItems: 'center' }}>
                            T
                            <span className="brand-paw-container">
                                ı
                                <PawPrint className="brand-paw-icon" fill="currentColor" />
                            </span>
                            ger
                        </div>
                        <div className="brand-part-friends" style={{ fontSize: '4rem', fontWeight: '700', display: 'flex', alignItems: 'center' }}>
                            Sm
                            <span className="brand-paw-container">
                                ı
                                <PawPrint className="brand-paw-icon" fill="currentColor" />
                            </span>
                            le
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
