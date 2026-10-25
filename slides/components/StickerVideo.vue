<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';
import { ref, watch } from 'vue';
import { publicUrl } from '../utils/public-url.ts';

// A looping video stuck into the album like a photo sticker: thick white edge, slight tilt.
// Plays only while its slide is open and starts over each time the slide opens.
const props = withDefaults(defineProps<{ src: string; width?: number; rotate?: number }>(), {
  width: 720,
  rotate: -2,
});

const active = useIsSlideActive();
const video = ref<HTMLVideoElement>();
const failed = ref(false);

watch(
  [active, video],
  ([isActive, el]) => {
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="photo" :class="{ stuck: active }" :style="{ width: `${props.width}px`, '--rot': `${props.rotate}deg` }">
    <video v-if="!failed" ref="video" :src="publicUrl(src)" muted loop playsinline preload="auto" @error="failed = true" />
    <div v-else class="missing print">Video fehlt: {{ src }}</div>
  </div>
</template>

<style scoped>
.photo {
  padding: 14px;
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.3);
  transform: rotate(var(--rot));
}

.photo video,
.missing {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 14px;
  object-fit: cover;
  background: #e9f1fc;
}

.missing {
  display: grid;
  place-items: center;
  color: var(--ink);
}

.photo.stuck {
  animation: stick 700ms var(--ease-out) both;
}

@keyframes stick {
  from {
    transform: translateY(-26px) scale(1.04) rotate(calc(var(--rot) + 4deg));
    box-shadow: 0 34px 40px rgb(27 19 64 / 0.2);
  }
  to {
    transform: rotate(var(--rot));
    box-shadow: 0 14px 28px rgb(27 19 64 / 0.3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .photo.stuck {
    animation: none;
  }
}
</style>
