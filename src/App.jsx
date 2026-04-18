import React from 'react';
import { SpinVinyl } from './pages/SpinVinyl';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 32, color: '#f87171', fontFamily: 'monospace', background: '#0f0f0f', minHeight: '100vh' }}>
                    <h2 style={{ color: '#fff', marginBottom: 12 }}>Something went wrong</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error?.message}</pre>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#6b7280', marginTop: 12 }}>{this.state.error?.stack}</pre>
                    <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
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