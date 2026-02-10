import { PerformanceMetrics } from '@monitor/shared/types';
import { onCLS, onFCP, onINP, onLCP } from 'web-vitals';

/**
 * 性能监控类
 * 负责收集页面的核心性能指标：FCP、LCP、FID、CLS
 */
export class PerformanceMonitor {
  // 存储已收集的性能指标
  private metrics: Partial<PerformanceMetrics> = {};
  // 报告回调函数，当收集到足够的性能数据时调用
  private onReport: (metrics: PerformanceMetrics) => void;

  /**
   * 构造函数
   * @param onReport - 当收集到完整的性能指标时调用的回调函数
   */
  constructor(onReport: (metrics: PerformanceMetrics) => void) {
    this.onReport = onReport;
    this.init();
  }

  /**
   * 初始化性能监控
   * 注册所有核心性能指标的观察者
   */
  private init() {
    if (typeof window === 'undefined') return;

    this.observeFCP(); // 首次内容绘制时间
    this.observeLCP(); // 最大内容绘制时间
    this.observeFID(); // 首次输入延迟
    this.observeCLS(); // 累积布局偏移
  }

  /**
   * 观察首次内容绘制时间 (First Contentful Paint)
   * FCP 测量从页面开始加载到页面任何部分在屏幕上渲染的时间点
   * 实现原理：通过 PerformanceObserver 监听 paint 类型的性能条目
   */
  private observeFCP() {
    onFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.checkAndReport();
    });
  }

  /**
   * 观察最大内容绘制时间 (Largest Contentful Paint)
   * LCP 测量视口中最大的内容元素何时完成渲染的时间
   * 实现原理：通过 PerformanceObserver 监听 largest-contentful-paint 类型的性能条目
   */
  private observeLCP() {
    onLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.checkAndReport();
    });
  }

  /**
   * 观察首次输入延迟 (First Input Delay)
   * FID 测量用户第一次与页面交互到浏览器实际能够响应该交互的时间
   * 实现原理：通过 PerformanceObserver 监听 interaction 类型的性能条目
   */
  private observeFID() {
    onINP((metric) => {
      this.metrics.fid = metric.value;
      this.checkAndReport();
    });
  }

  /**
   * 观察累积布局偏移 (Cumulative Layout Shift)
   * CLS 测量页面生命周期内发生的每次意外布局偏移的得分总和
   * 实现原理：通过 PerformanceObserver 监听 layout-shift 类型的性能条目
   */
  private observeCLS() {
    onCLS((metric) => {
      this.metrics.cls = metric.value;
      this.checkAndReport();
    });
  }

  /**
   * 检查是否已经收集了足够的性能指标来报告
   * 只有当 FCP 和 LCP 都存在时才认为数据完整
   */
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
