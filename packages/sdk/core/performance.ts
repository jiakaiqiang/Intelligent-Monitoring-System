import { PerformanceMetrics } from '@monitor/shared/types';

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private onReport: (metrics: PerformanceMetrics) => void;

  constructor(onReport: (metrics: PerformanceMetrics) => void) {
    this.onReport = onReport;
    this.init();
  }

  private init() {
    this.observeFCP();
    this.observeLCP();
    this.observeFID();
    this.observeCLS();
  }

  private observeFCP() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.metrics.fcp = entry.startTime;
          this.checkAndReport();
        }
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.metrics.lcp = lastEntry.startTime;
      this.checkAndReport();
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  }

  private observeFID() {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming;
        this.metrics.fid = fidEntry.processingStart - fidEntry.startTime;
        this.checkAndReport();
      }
    });

    observer.observe({ entryTypes: ['first-input'] });
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          this.metrics.cls = clsValue;
        }
      }
      this.checkAndReport();
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  }

  private checkAndReport() {
    if (this.metrics.fcp && this.metrics.lcp) {
      const fullMetrics: PerformanceMetrics = {
        fcp: this.metrics.fcp,
        lcp: this.metrics.lcp,
        fid: this.metrics.fid,
        cls: this.metrics.cls,
        timestamp: Date.now(),
      };
      this.onReport(fullMetrics);
    }
  }
}
