<script setup lang="ts">
// The day's five exercises as the staircase from page 2: done ones carry their sticker, the current one
// gets its sticker pressed on and its caption, the ones still to come are numbered empty slots.
const props = defineProps<{ current: 1 | 2 | 3 | 4 | 5 }>();

const steps = [
  { src: '/scratch/fish.svg', alt: 'Fisch', width: 100 },
  { src: '/art/chip-ki.svg', alt: 'KI-Chip', width: 86 },
  { src: '/art/lightbulb.svg', alt: 'Glühbirne', width: 82 },
  { src: '/art/chat.svg', alt: 'Zwei Sprechblasen', width: 94 },
  { src: '/art/code-editor.svg', alt: 'Code-Editor', width: 100 },
];
const tilt = [-6, 5, -4, 6, -3];
</script>

<template>
  <div class="stairs">
    <div v-for="(step, i) in steps" :key="i" class="step" :style="{ marginBottom: `${i * 44}px` }">
      <Slot :number="i + 1" :size="116">
        <Sticker
          v-if="i + 1 <= props.current"
          :src="step.src"
          :alt="step.alt"
          :width="step.width"
          :rotate="tilt[i]"
          :delay="i + 1 === props.current ? 450 : i * 120"
        />
      </Slot>
      <div v-if="i + 1 === props.current" class="caption print">Übung {{ i + 1 }}</div>
    </div>
  </div>
</template>

<style scoped>
.stairs {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.step {
  position: relative;
}

/* out of the flow, so the caption doesn't lift its step */
.caption {
  position: absolute;
  top: calc(100% + 12px);
  left: 0;
  right: 0;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}
</style>
