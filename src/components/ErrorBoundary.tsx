import { Component, type ErrorInfo, type ReactNode } from 'react';
export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Brain Sweat could not render this screen:', error.message, info.componentStack); }
  render() { return this.state.hasError ? <div className="error-panel"><h1>Let’s get you back to the studio.</h1><p>This screen ran into a problem. Your saved progress is still on this device.</p><button className="btn primary" onClick={() => { window.location.hash = '/'; window.location.reload(); }}>Reload studio</button></div> : this.props.children; }
}
