import { Monitor } from '../core';

export interface Plugin {
  name: string;
  install: (monitor: Monitor) => void;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin) {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} already registered`);
      return;
    }
    this.plugins.set(plugin.name, plugin);
  }

  install(monitor: Monitor) {
    this.plugins.forEach((plugin) => {
      plugin.install(monitor);
    });
  }

  unregister(name: string) {
    this.plugins.delete(name);
  }
}
