<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';

// Scratch's own "sagen" bubble from the stage: white, soft grey edge, tail at the lower left.
withDefaults(defineProps<{ delay?: number }>(), { delay: 0 });
const active = useIsSlideActive();
</script>

<template>
  <div class="bubble" :class="{ pop: active }" :style="{ '--delay': `${delay}ms` }">
    <slot />
    <svg class="tail" viewBox="0 0 60 44" aria-hidden="true">
      <path d="M4 0 C 10 18, 6 32, 2 42 C 20 34, 36 20, 46 0" fill="#fff" stroke="#c4c8d6" stroke-width="4" stroke-linejoin="round" />
      <path d="M2 -6 L 50 -6 L 50 3 L 2 3 Z" fill="#fff" />
    </svg>
  </div>
</template>

<style scoped>
.bubble {
  position: relative;
  padding: 26px 44px 30px;
  border: 4px solid #c4c8d6;
  border-radius: 34px;
  background: #fff;
  color: #575e75; /* Scratch's text grey on the stage bubble */
  font-family: var(--font-display);
  font-size: var(--size-display);
  line-height: 1;
  white-space: nowrap;
  filter: drop-shadow(0 10px 14px rgb(27 19 64 / 0.22));
  transform-origin: 10% 100%;
}

.tail {
  position: absolute;
  left: 46px;
  bottom: -40px;
  width: 60px;
  height: 44px;
  overflow: visible;
}

.bubble.pop {
  animation: pop 520ms var(--ease-out) var(--delay) both;
}

@keyframes pop {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bubble.pop {
    animation: none;
  }
}
</style>
