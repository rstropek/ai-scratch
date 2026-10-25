<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';

// Scratch's own "sagen" bubble from the stage: white, soft grey edge, tail at the lower left.
// `long` sets a whole sentence at text size and lets it wrap.
// `tail="left"`/`"right"` puts a short side tail at the lower corner, for a chat between two speakers.
withDefaults(defineProps<{ delay?: number; long?: boolean; tail?: 'down' | 'left' | 'right' }>(), {
  delay: 0,
  long: false,
  tail: 'down',
});
const active = useIsSlideActive();
</script>

<template>
  <div class="bubble" :class="[`tail-${tail}`, { pop: active, long }]" :style="{ '--delay': `${delay}ms` }">
    <slot />
    <svg v-if="tail === 'down'" class="tail" viewBox="0 0 60 44" aria-hidden="true">
      <path d="M4 0 C 10 18, 6 32, 2 42 C 20 34, 36 20, 46 0" fill="#fff" stroke="#c4c8d6" stroke-width="4" stroke-linejoin="round" />
      <path d="M2 -6 L 50 -6 L 50 3 L 2 3 Z" fill="#fff" />
    </svg>
    <svg v-else class="side-tail" viewBox="0 0 40 36" aria-hidden="true">
      <path d="M36 4 C 26 6, 16 18, 2 32 C 14 32, 26 28, 36 26" fill="#fff" stroke="#c4c8d6" stroke-width="4" stroke-linejoin="round" />
      <path d="M31 6 L 42 6 L 42 24 L 31 24 Z" fill="#fff" />
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

.bubble.long {
  padding: 20px 30px 24px;
  border-radius: 28px;
  font-family: var(--font-text);
  font-size: var(--size-text);
  font-weight: 600;
  line-height: 1.3;
  white-space: normal;
  text-wrap: pretty;
}

.tail {
  position: absolute;
  left: 46px;
  bottom: -40px;
  width: 60px;
  height: 44px;
  overflow: visible;
}

/* chat bubbles: tighter, so a whole conversation fits on one page */
.bubble.long:not(.tail-down) {
  padding: 14px 26px 16px;
}

.side-tail {
  position: absolute;
  bottom: 10px;
  left: -36px;
  width: 40px;
  height: 36px;
  overflow: visible;
}

.tail-right {
  transform-origin: 90% 100%;
}

.tail-right .side-tail {
  left: auto;
  right: -36px;
  transform: scaleX(-1);
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
