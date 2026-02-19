
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught Error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', background: '#ffe6e6', height: '100vh', overflow: 'auto' }}>
                    <h1>Something went wrong.</h1>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.href = '/login';
                        }}
                        style={{ padding: '10px 20px', marginBottom: '20px', background: '#ff4757', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        Clear Cache & Restart
                    </button>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
