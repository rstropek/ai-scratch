<script setup lang="ts">
import { useIsSlideActive } from '@slidev/client';
import { computed } from 'vue';

// What the AI gets for one question: a window frame of fixed size with the whole chat so far inside.
// Messages alternate (kid left, AI right); everything but the newest question is marked as told again,
// in the same marker yellow as the repeated words on the phone-call page. Messages that don't fit stick
// out below the frame.
const props = withDefaults(defineProps<{ messages: number; label: string; delay?: number }>(), { delay: 0 });

// fixed widths in %, so the same message keeps its length from window to window
const KID = [72, 58, 80, 50, 66, 76, 54, 70];
const AI = [56, 78, 62, 84, 60, 70, 52, 74];

const items = computed(() =>
  Array.from({ length: props.messages }, (_, i) => {
    const kid = i % 2 === 0;
    const n = Math.floor(i / 2) % KID.length;
    return { kid, width: kid ? KID[n] : AI[n], newest: i === props.messages - 1 };
  }),
);
const active = useIsSlideActive();
</script>

<template>
  <div class="ctx" :class="{ show: active }" :style="{ '--delay': `${delay}ms` }">
    <div class="ctx-label print">{{ label }}</div>
    <div class="frame">
      <div
        v-for="(m, i) in items"
        :key="i"
        class="msg"
        :class="{ kid: m.kid, again: !m.newest }"
        :style="{ width: `${m.width}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.ctx {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 200px;
}

.ctx-label {
  font-weight: 600;
  text-align: center;
}

/* the window: a solid white frame on the page, the album ground shows through */
.frame {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 270px;
  padding: 16px 14px;
  border: 8px solid #fff;
  border-radius: 22px;
  background: color-mix(in srgb, #fff 12%, transparent);
  box-shadow: 0 14px 28px rgb(27 19 64 / 0.28);
}

.msg {
  flex: none;
  align-self: flex-end;
  height: 24px;
  border-radius: 12px 12px 4px 12px;
  background: #fff;
  box-shadow: 0 3px 6px rgb(27 19 64 / 0.2);
}

.msg.kid {
  align-self: flex-start;
  border-radius: 12px 12px 12px 4px;
}

/* told again: the marker yellow */
.msg.again {
  background: #ffd84d;
}

.ctx.show {
  animation: lay 700ms var(--ease-out) var(--delay) both;
}

@keyframes lay {
  from {
    opacity: 0;
    transform: translateY(-26px) scale(1.04) rotate(3deg);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ctx.show {
    animation: none;
  }
}
</style>
