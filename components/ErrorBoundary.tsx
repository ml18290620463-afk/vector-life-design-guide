import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { CyberButton } from './CyberButton';
import { AppError, reportError } from '../lib/error';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  traceId: string | null;
}

const generateTraceId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID().split('-')[0].toUpperCase();
    }
  } catch {
    // fall through
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
};

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    traceId: null,
  };

  public static getDerivedStateFromError(_error: Error): State {
    return { hasError: true, traceId: generateTraceId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportError(AppError.fromError(error), `ErrorBoundary:${this.state.traceId ?? 'unknown'}`);
    if (process.env.NODE_ENV !== 'production') {
      console.error('Uncaught error:', error, errorInfo);
    }
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-vector-night-blue flex items-center justify-center p-6 font-mono">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md border border-rose-500/30 bg-rose-950/5 p-8 rounded-2xl relative overflow-hidden shadow-2xl"
          >
            {/* Background Glitch Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-950/20 text-rose-500 mb-4 shadow-[0_0_20px_color-mix(in_srgb,_var(--color-rose-500)_20%,_transparent)]">
                <AlertCircle size={40} />
              </div>

              <h2 className="text-2xl font-black tracking-tighter text-rose-100 uppercase italic">
                System Core Failure // 系统核心崩溃
              </h2>

              <div className="p-4 bg-black/60 rounded border border-rose-900/30 text-left">
                <div className="text-[10px] text-rose-500/50 uppercase mb-1">Trace ID:</div>
                <div className="text-xs text-rose-400 font-mono break-all leading-relaxed opacity-80">
                  {this.state.traceId ?? 'CRITICAL_KERNEL_ERROR'}
                </div>
                <div className="text-[10px] text-rose-500/50 uppercase mt-3">Detail:</div>
                <div className="text-xs text-rose-300/80 font-mono leading-relaxed">
                  An unexpected error occurred. Please reload to recover the session.
                </div>
              </div>

              <p className="text-xs text-rose-800 tracking-widest uppercase font-black opacity-60">
                Temporal Anchor Disconnected // 时空锚点已断开
              </p>

              <div className="pt-4">
                <CyberButton
                  onClick={this.handleReset}
                  variant="primary"
                  className="w-full !bg-rose-500/20 !border-rose-500/50 !text-rose-400 hover:!bg-rose-500/40 shadow-[0_0_15px_color-mix(in_srgb,_var(--color-rose-500)_10%,_transparent)]"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RotateCcw size={16} />
                    <span>Reboot Sequence // 重新载入</span>
                  </div>
                </CyberButton>
              </div>
            </div>

            {/* Corner Accents */}
            <span className="absolute top-0 left-0 w-4 h-4 border-l border-t border-rose-500/30" />
            <span className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-rose-500/30" />
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
