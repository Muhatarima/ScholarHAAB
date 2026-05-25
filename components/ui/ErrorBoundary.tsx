'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ScholarHAAB caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 rounded-lg bg-gray-100 text-gray-600 text-center">
            <p className="font-medium">Something went wrong loading this section.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 text-purple-600 underline text-sm"
              type="button"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
