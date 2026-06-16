import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#0c0c12',
          border: '1px solid #2b1114',
          borderRadius: '6px',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'monospace',
          margin: '10px 0'
        }}>
          <div style={{ color: '#ff3d00', fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px', marginBottom: '8px' }}>
            ⚠️ PANEL RENDER ERROR
          </div>
          <div style={{ fontSize: '9px', color: '#888899', wordBreak: 'break-all' }}>
            {this.state.error?.toString() || "Unknown rendering exception"}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '12px',
              padding: '4px 10px',
              backgroundColor: '#111116',
              color: '#ffea00',
              border: '1px solid #ffea00',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold',
            }}
          >
            ⟳ RELOAD PANEL
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
