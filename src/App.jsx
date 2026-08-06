import React from 'react';
import { SpinVinyl } from './pages/SpinVinyl';
import { captureException } from './lib/sentry.js';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, errorInfo) {
        captureException(error, { componentStack: errorInfo.componentStack });
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 32, color: '#f87171', fontFamily: 'monospace', background: '#0c0a09', minHeight: '100vh' }}>
                    <h2 style={{ color: '#F2E9DC', marginBottom: 12 }}>Something went wrong</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#78716c', marginTop: 12 }}>{this.state.error?.stack}</pre>
                    <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#A84E22', color: '#F2E9DC', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function App() {
    return <ErrorBoundary><SpinVinyl /></ErrorBoundary>;
}

export default App;