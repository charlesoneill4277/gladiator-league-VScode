import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Clock, Database, Zap } from 'lucide-react';

interface PerformanceMetrics {
    initialLoadTime: number;
    apiCallCount: number;
    cacheHitRate: number;
    memoryUsage: number;
    lastUpdate: number;
}

interface PerformanceMonitorProps {
    enabled?: boolean;
    onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
    enabled = process.env.NODE_ENV === 'development',
    onMetricsUpdate
}) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        initialLoadTime: 0,
        apiCallCount: 0,
        cacheHitRate: 0,
        memoryUsage: 0,
        lastUpdate: Date.now()
    });

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const updateMetrics = () => {
            const newMetrics: PerformanceMetrics = {
                initialLoadTime: performance.now(),
                apiCallCount: (window as any).__apiCallCount || 0,
                cacheHitRate: (window as any).__cacheHitRate || 0,
                memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
                lastUpdate: Date.now()
            };

            setMetrics(newMetrics);
            onMetricsUpdate?.(newMetrics);
        };

        // Update metrics every 2 seconds
        const interval = setInterval(updateMetrics, 2000);
        updateMetrics(); // Initial update

        return () => clearInterval(interval);
    }, [enabled, onMetricsUpdate]);

    // Toggle visibility with keyboard shortcut
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                setIsVisible(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);

    if (!enabled || !isVisible) {
        return (
            <div className="fixed bottom-20 right-4 z-40">
                <Badge
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => setIsVisible(true)}
                >
                    <Activity className="h-3 w-3 mr-1" />
                    Perf
                </Badge>
            </div>
        );
    }

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatTime = (ms: number) => {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="fixed bottom-20 right-4 z-40 w-80">
            <Card className="border-l-4 border-l-green-500 shadow-lg">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center">
                            <Activity className="h-4 w-4 mr-2" />
                            Performance Monitor
                        </CardTitle>
                        <button
                            onClick={() => setIsVisible(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            ✕
                        </button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="flex items-center space-x-2">
                            <Clock className="h-3 w-3 text-blue-500" />
                            <div>
                                <div className="font-medium">Load Time</div>
                                <div className="text-muted-foreground">
                                    {formatTime(metrics.initialLoadTime)}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Database className="h-3 w-3 text-purple-500" />
                            <div>
                                <div className="font-medium">API Calls</div>
                                <div className="text-muted-foreground">
                                    {metrics.apiCallCount}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Zap className="h-3 w-3 text-yellow-500" />
                            <div>
                                <div className="font-medium">Cache Hit</div>
                                <div className="text-muted-foreground">
                                    {(metrics.cacheHitRate * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Activity className="h-3 w-3 text-red-500" />
                            <div>
                                <div className="font-medium">Memory</div>
                                <div className="text-muted-foreground">
                                    {formatBytes(metrics.memoryUsage)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground border-t pt-2">
                        Press Ctrl+Shift+P to toggle • Last update: {new Date(metrics.lastUpdate).toLocaleTimeString()}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// Performance tracking utilities
export const trackApiCall = () => {
    (window as any).__apiCallCount = ((window as any).__apiCallCount || 0) + 1;
};

export const trackCacheHit = (hit: boolean) => {
    const current = (window as any).__cacheStats || { hits: 0, total: 0 };
    current.total += 1;
    if (hit) current.hits += 1;
    (window as any).__cacheStats = current;
    (window as any).__cacheHitRate = current.total > 0 ? current.hits / current.total : 0;
};

export const resetPerformanceMetrics = () => {
    (window as any).__apiCallCount = 0;
    (window as any).__cacheStats = { hits: 0, total: 0 };
    (window as any).__cacheHitRate = 0;
};

export default PerformanceMonitor;