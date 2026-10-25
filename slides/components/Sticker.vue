<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';
import { computed, useId } from 'vue';

// A die-cut sticker: the picture gets an even white edge that follows its own outline
// and a lifted shadow. When the slide opens it is pressed onto the page once and the shadow settles.
const props = withDefaults(
  defineProps<{
    src: string;
    alt: string;
    width?: number;
    rotate?: number;
    delay?: number;
  }>(),
  { width: 280, rotate: 0, delay: 0 },
);

const active = useIsSlideActive();
// the white edge grows with the sticker, so small ones keep their shape
const edge = computed(() => Math.max(2, Math.round(props.width * 0.025)));
// each sticker carries its own filter, so it also renders in overview and export
const filterId = `die-cut-${useId()}`;
</script>

<template>
  <div
    class="sticker"
    :class="{ stuck: active }"
    :style="{ width: `${width}px`, '--rot': `${rotate}deg`, '--delay': `${delay}ms` }"
  >
    <svg width="0" height="0" aria-hidden="true" class="defs">
      <filter :id="filterId" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" :radius="edge" result="grown" />
        <feFlood flood-color="#fff" />
        <feComposite in2="grown" operator="in" result="edge" />
        <feMerge>
          <feMergeNode in="edge" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
    <img :src="src" :alt="alt" draggable="false" :style="{ filter: `url(#${filterId})` }" />
  </div>
</template>

<style scoped>
.sticker {
  transform: rotate(var(--rot));
  transform-origin: 50% 60%;
  filter: drop-shadow(0 10px 14px rgb(27 19 64 / 0.28));
}

.defs {
  position: absolute;
}

.sticker img {
  display: block;
  width: 100%;
  height: auto;
}

.sticker.stuck {
  animation: stick 700ms var(--ease-out) var(--delay) both;
}

@keyframes stick {
  from {
    transform: translateY(-26px) scale(1.08) rotate(calc(var(--rot) + 7deg));
    filter: drop-shadow(0 30px 30px rgb(27 19 64 / 0.2));
  }
  to {
    transform: rotate(var(--rot));
    filter: drop-shadow(0 10px 14px rgb(27 19 64 / 0.28));
  }
}

@media (prefers-reduced-motion: reduce) {
  .sticker.stuck {
    animation: none;
  }
}
</style>
