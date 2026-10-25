<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';

// A rubber stamp pressed onto a paper label: double ink border, tilted, lands with a thump after the stickers.
// The label keeps it readable where it overlaps a coloured page.
withDefaults(defineProps<{ rotate?: number; delay?: number }>(), { rotate: -12, delay: 600 });
const active = useIsSlideActive();
</script>

<template>
  <div class="stamp" :class="{ thump: active }" :style="{ '--rot': `${rotate}deg`, '--delay': `${delay}ms` }">
    <slot />
  </div>
</template>

<style scoped>
.stamp {
  display: inline-block;
  padding: 10px 22px 12px;
  border: 5px solid currentColor;
  border-radius: 14px;
  outline: 2px solid currentColor;
  outline-offset: 4px;
  background: #fff;
  box-shadow: 0 0 0 8px #fff, 0 8px 16px 6px rgb(27 19 64 / 0.22);
  color: #d92b57;
  font-family: var(--font-display);
  font-size: var(--size-text);
  line-height: 1;
  white-space: nowrap;
  transform: rotate(var(--rot));
}

.stamp.thump {
  animation: thump 380ms var(--ease-out) var(--delay) both;
}

@keyframes thump {
  from {
    transform: rotate(var(--rot)) scale(1.35);
  }
  to {
    transform: rotate(var(--rot)) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .stamp.thump {
    animation: none;
  }
}
</style>
