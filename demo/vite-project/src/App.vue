<script setup>
     import Monitor from '@monitor/sdk';

      const monitor = new Monitor({
        projectId: 'demo-project',
        reportUrl: 'http://10.173.26.56:3000',
        maxErrors: 5,
        sampleRate: 1,
      });

    
      const triggerError = ()=>{
          throw new Error('Test error from button click');
      }
      const promiseBtn = ()=>{
        Promise.reject(new Error('Test promise rejection'));
      }

      window.addEventListener('load', () => {
        setTimeout(() => {
          monitor.report();
        }, 3000);
      });
</script>

<template>
  <h1>Monitor SDK Demo</h1>
    <button @click="triggerError">Trigger Error</button>
    <button @click="promiseBtn">Trigger Promise Error</button>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
