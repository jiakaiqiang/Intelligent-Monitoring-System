import { Monitor } from '../core';

/**
 * 插件接口
 * 定义插件的基本结构
 */
export interface Plugin {
  /** 插件名称，需唯一 */
  name: string;
  /** 插件安装方法 */
  install: (monitor: Monitor) => void;
}

/**
 * 插件管理器
 * 负责插件的注册、安装和卸载
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  /**
   * 注册插件
   * @param plugin 要注册的插件
   * @returns 当前插件管理器实例
   */
  register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} already registered`);
      return;
    }
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * 安装所有已注册插件
   * @param monitor 要安装插件的监控实例
   * @returns 当前插件管理器实例
   */
  install(monitor: Monitor) {
    this.plugins.forEach((plugin) => {
      plugin.install(monitor);
    });
  }

  /**
   * 卸载指定插件
   * @param name 要卸载的插件名称
   * @returns 当前插件管理器实例
   */
  unregister(name: string) {
    this.plugins.delete(name);
  }
}
