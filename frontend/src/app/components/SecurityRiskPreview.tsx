import { AlertTriangle, CheckCircle, Lock, Shield, Clock, Eye, Download, AlertCircle, X } from 'lucide-react';

export interface RiskAnalysis {
  level: 'low' | 'medium' | 'high';
  score: number;
  issues: string[];
  recommendations: Array<{
    icon: any;
    title: string;
    description: string;
    action: () => void;
    actionLabel: string;
  }>;
}

interface SecurityRiskPreviewProps {
  analysis: RiskAnalysis;
  fileName: string;
  onClose: () => void;
}

export function SecurityRiskPreview({ analysis, fileName, onClose }: SecurityRiskPreviewProps) {
  const getRiskConfig = () => {
    switch (analysis.level) {
      case 'low':
        return {
          color: 'text-green-600',
          bg: 'bg-green-100',
          borderColor: 'border-green-600',
          label: 'Low Risk',
          icon: CheckCircle,
          description: 'This file has strong protection measures in place.',
        };
      case 'medium':
        return {
          color: 'text-yellow-600',
          bg: 'bg-yellow-100',
          borderColor: 'border-yellow-600',
          label: 'Medium Risk',
          icon: AlertCircle,
          description: 'This file has some protection but could be improved.',
        };
      case 'high':
        return {
          color: 'text-red-600',
          bg: 'bg-red-100',
          borderColor: 'border-red-600',
          label: 'High Risk',
          icon: AlertTriangle,
          description: 'This file is vulnerable and needs immediate protection.',
        };
    }
  };

  const config = getRiskConfig();
  const RiskIcon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="relative max-w-3xl w-full bg-card rounded-lg overflow-hidden my-auto" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-background/80 hover:bg-background rounded-full transition-colors z-10"
          aria-label="Close risk preview"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>

        <div className="p-6">
          <h2 className="text-foreground mb-2">Security Risk Analysis</h2>
          <p className="text-muted-foreground mb-6">{fileName}</p>

          <div className={`${config.bg} border-2 ${config.borderColor} rounded-lg p-6 mb-6`}>
            <div className="flex items-start gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full bg-white flex items-center justify-center flex-shrink-0`}>
                <RiskIcon className={`w-7 h-7 ${config.color}`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-foreground mb-1`}>Risk Level: {config.label}</h3>
                <p className="text-sm text-muted-foreground mb-3">{config.description}</p>

                <div className="space-y-1 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Security Score</span>
                    <span className={`${config.color}`}>{analysis.score}/100</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        analysis.level === 'low' ? 'bg-green-600' :
                        analysis.level === 'medium' ? 'bg-yellow-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${analysis.score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {analysis.issues.length > 0 && (
              <div className="bg-white rounded-lg p-4">
                <h4 className="text-foreground mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Identified Issues
                </h4>
                <ul className="space-y-1">
                  {analysis.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {analysis.recommendations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-foreground mb-4">Recommended Fixes</h3>
              <div className="space-y-3">
                {analysis.recommendations.map((rec, index) => {
                  const RecIcon = rec.icon;
                  return (
                    <div key={index} className="flex items-start gap-4 p-4 bg-accent rounded-lg">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <RecIcon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-accent-foreground mb-1">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                        <button
                          onClick={rec.action}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
                        >
                          {rec.actionLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
