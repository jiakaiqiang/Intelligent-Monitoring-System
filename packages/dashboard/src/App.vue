<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import ErrorList from '../components/ErrorList.vue';
import PerformanceDashboard from '../components/PerformanceDashboard.vue';

type View = 'errors' | 'performance';

const currentView = ref<View>('errors');
const currentTime = ref(new Date());
const systemStatus = ref('ONLINE');

// Update time every second
onMounted(() => {
  setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).toUpperCase();
});
</script>

<template>
  <div class="nx-app">
    <!-- Ambient glow effects -->
    <div class="nx-ambient-glow nx-ambient-glow--cyan"></div>
    <div class="nx-ambient-glow nx-ambient-glow--magenta"></div>

    <!-- Header -->
    <header class="nx-header">
      <div class="nx-header__left">
        <div class="nx-logo">
          <div class="nx-logo__icon">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 2L38 12V28L20 38L2 28V12L20 2Z" stroke="currentColor" stroke-width="2"/>
              <path d="M20 8L32 15V25L20 32L8 25V15L20 8Z" fill="currentColor" opacity="0.3"/>
              <circle cx="20" cy="20" r="4" fill="currentColor"/>
            </svg>
          </div>
          <div class="nx-logo__text">
            <span class="nx-logo__title">NEXUS</span>
            <span class="nx-logo__subtitle">MONITOR SYSTEM</span>
          </div>
        </div>
      </div>

      <div class="nx-header__center">
        <nav class="nx-nav">
          <button
            class="nx-nav__item"
            :class="{ 'nx-nav__item--active': currentView === 'errors' }"
            @click="currentView = 'errors'"
          >
            <span class="nx-nav__icon">⚠</span>
            <span class="nx-nav__label">ERROR_LOG</span>
            <span class="nx-nav__indicator"></span>
          </button>
          <button
            class="nx-nav__item"
            :class="{ 'nx-nav__item--active': currentView === 'performance' }"
            @click="currentView = 'performance'"
          >
            <span class="nx-nav__icon">◈</span>
            <span class="nx-nav__label">PERF_METRICS</span>
            <span class="nx-nav__indicator"></span>
          </button>
        </nav>
      </div>

      <div class="nx-header__right">
        <div class="nx-status-panel">
          <div class="nx-status-panel__item">
            <span class="nx-status-panel__label">SYS_STATUS</span>
            <span class="nx-status-panel__value nx-status-panel__value--online">
              <span class="nx-pulse"></span>
              {{ systemStatus }}
            </span>
          </div>
          <div class="nx-status-panel__divider"></div>
          <div class="nx-status-panel__item">
            <span class="nx-status-panel__label">{{ formattedDate }}</span>
            <span class="nx-status-panel__value nx-status-panel__value--time">{{ formattedTime }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="nx-main">
      <div class="nx-content">
        <Transition name="nx-fade" mode="out-in">
          <ErrorList v-if="currentView === 'errors'" key="errors" />
          <PerformanceDashboard v-else key="performance" />
        </Transition>
      </div>
    </main>

    <!-- Footer -->
    <footer class="nx-footer">
      <div class="nx-footer__left">
        <span class="nx-footer__text">NEXUS_MONITOR v2.0.0</span>
      </div>
      <div class="nx-footer__center">
        <div class="nx-data-stream">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="nx-footer__right">
        <span class="nx-footer__text">SECURE_CONNECTION::ESTABLISHED</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.nx-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* Ambient Glow Effects */
.nx-ambient-glow {
  position: fixed;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  filter: blur(150px);
  opacity: 0.15;
  pointer-events: none;
  z-index: 0;
}

.nx-ambient-glow--cyan {
  background: var(--nx-cyan);
  top: -200px;
  left: -200px;
  animation: pulse-glow 8s ease-in-out infinite;
}

.nx-ambient-glow--magenta {
  background: var(--nx-magenta);
  bottom: -200px;
  right: -200px;
  animation: pulse-glow 8s ease-in-out infinite 4s;
}

/* Header */
.nx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: linear-gradient(180deg, var(--nx-surface) 0%, transparent 100%);
  border-bottom: 1px solid var(--nx-border);
  position: relative;
  z-index: 100;
}

.nx-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--nx-cyan), transparent);
  opacity: 0.5;
}

/* Logo */
.nx-logo {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.nx-logo__icon {
  width: 40px;
  height: 40px;
  color: var(--nx-cyan);
  animation: flicker 4s infinite;
}

.nx-logo__icon svg {
  width: 100%;
  height: 100%;
}

.nx-logo__text {
  display: flex;
  flex-direction: column;
}

.nx-logo__title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--nx-cyan);
  text-shadow: 0 0 20px var(--nx-cyan-glow);
}

.nx-logo__subtitle {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.3em;
  color: var(--nx-text-muted);
  margin-top: -2px;
}

/* Navigation */
.nx-nav {
  display: flex;
  gap: var(--space-sm);
}

.nx-nav__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: 1px solid var(--nx-border);
  color: var(--nx-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all var(--transition-normal);
}

.nx-nav__item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--nx-cyan-glow) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.nx-nav__item:hover {
  border-color: var(--nx-cyan-dim);
  color: var(--nx-text-primary);
}

.nx-nav__item:hover::before {
  opacity: 1;
}

.nx-nav__item--active {
  border-color: var(--nx-cyan);
  color: var(--nx-cyan);
  background: var(--nx-cyan-glow);
}

.nx-nav__item--active::before {
  opacity: 1;
}

.nx-nav__icon {
  font-size: 1rem;
}

.nx-nav__indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 2px;
  background: var(--nx-cyan);
  transition: width var(--transition-normal);
  box-shadow: 0 0 10px var(--nx-cyan);
}

.nx-nav__item--active .nx-nav__indicator {
  width: 80%;
}

/* Status Panel */
.nx-status-panel {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: var(--nx-elevated);
  border: 1px solid var(--nx-border);
}

.nx-status-panel__item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.nx-status-panel__label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
}

.nx-status-panel__value {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.nx-status-panel__value--online {
  color: var(--nx-green);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.nx-status-panel__value--time {
  color: var(--nx-cyan);
  font-variant-numeric: tabular-nums;
}

.nx-status-panel__divider {
  width: 1px;
  height: 30px;
  background: var(--nx-border);
}

.nx-pulse {
  width: 8px;
  height: 8px;
  background: var(--nx-green);
  border-radius: 50%;
  animation: pulse-glow 2s ease-in-out infinite;
  box-shadow: 0 0 10px var(--nx-green);
}

/* Main Content */
.nx-main {
  flex: 1;
  padding: var(--space-xl);
  position: relative;
  z-index: 1;
}

.nx-content {
  max-width: 1600px;
  margin: 0 auto;
}

/* Footer */
.nx-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: linear-gradient(0deg, var(--nx-surface) 0%, transparent 100%);
  border-top: 1px solid var(--nx-border);
  position: relative;
  z-index: 100;
}

.nx-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--nx-magenta), transparent);
  opacity: 0.3;
}

.nx-footer__text {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  color: var(--nx-text-muted);
}

.nx-data-stream {
  display: flex;
  gap: 3px;
}

.nx-data-stream span {
  width: 3px;
  height: 12px;
  background: var(--nx-cyan);
  opacity: 0.3;
  animation: data-stream-bar 1s ease-in-out infinite;
}

.nx-data-stream span:nth-child(1) { animation-delay: 0s; }
.nx-data-stream span:nth-child(2) { animation-delay: 0.1s; }
.nx-data-stream span:nth-child(3) { animation-delay: 0.2s; }
.nx-data-stream span:nth-child(4) { animation-delay: 0.3s; }
.nx-data-stream span:nth-child(5) { animation-delay: 0.4s; }

@keyframes data-stream-bar {
  0%, 100% { opacity: 0.3; transform: scaleY(0.5); }
  50% { opacity: 1; transform: scaleY(1); }
}

/* Transitions */
.nx-fade-enter-active,
.nx-fade-leave-active {
  transition: all 0.3s ease;
}

.nx-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.nx-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
