<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import {
  listAudioDevices,
  requestMicrophonePermission,
  supportsOutputSelection,
  type DeviceOption
} from "@/lib/voice/devices"

const props = defineProps<{
  modelValue: boolean
  initialInputDeviceId: string | null
  initialOutputDeviceId: string | null
}>()

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "confirm", payload: { inputDeviceId: string | null; outputDeviceId: string | null }): void
}>()

const inputs = ref<DeviceOption[]>([])
const outputs = ref<DeviceOption[]>([])
const inputDeviceId = ref<string | null>(props.initialInputDeviceId)
const outputDeviceId = ref<string | null>(props.initialInputDeviceId ? props.initialOutputDeviceId : null)
const permissionError = ref<string | null>(null)
const requesting = ref(false)
const level = ref(0)
const supportsOutput = supportsOutputSelection()

let stream: MediaStream | null = null
let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let source: MediaStreamAudioSourceNode | null = null
let levelTimer: number | null = null

function stopMeter(): void {
  if (levelTimer) {
    window.cancelAnimationFrame(levelTimer)
    levelTimer = null
  }
  analyser?.disconnect()
  source?.disconnect()
  analyser = null
  source = null
  if (context && context.state !== "closed") {
    void context.close()
  }
  context = null
  level.value = 0
}

function stopStream(): void {
  stopMeter()
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
}

async function refreshDevices(): Promise<void> {
  const { inputs: ins, outputs: outs } = await listAudioDevices()
  inputs.value = ins
  outputs.value = outs
  if (!inputDeviceId.value && ins[0]) inputDeviceId.value = ins[0].deviceId
  if (supportsOutput && !outputDeviceId.value && outs[0]) outputDeviceId.value = outs[0].deviceId
}

async function startMeter(): Promise<void> {
  stopMeter()
  if (!stream) return
  context = new AudioContext()
  source = context.createMediaStreamSource(stream)
  analyser = context.createAnalyser()
  analyser.fftSize = 1024
  source.connect(analyser)
  const buffer = new Uint8Array(analyser.fftSize)
  const tick = () => {
    if (!analyser) return
    analyser.getByteTimeDomainData(buffer)
    let sumSquares = 0
    for (const sample of buffer) {
      const normalized = (sample - 128) / 128
      sumSquares += normalized * normalized
    }
    const rms = Math.sqrt(sumSquares / buffer.length)
    level.value = Math.min(1, rms * 2.5)
    levelTimer = window.requestAnimationFrame(tick)
  }
  tick()
}

async function obtainStream(deviceId: string | null): Promise<void> {
  stopStream()
  try {
    stream = await requestMicrophonePermission(deviceId)
    permissionError.value = null
    await refreshDevices()
    await startMeter()
  } catch (error) {
    permissionError.value = error instanceof Error ? error.message : "Microphone access denied"
  }
}

async function open(): Promise<void> {
  requesting.value = true
  await refreshDevices()
  try {
    await obtainStream(inputDeviceId.value)
  } finally {
    requesting.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) {
      void open()
    } else {
      stopStream()
    }
  },
  { immediate: true }
)

watch(inputDeviceId, async (next) => {
  if (!props.modelValue) return
  if (!next) return
  await obtainStream(next)
})

const meterStyle = computed(() => ({ width: `${Math.round(level.value * 100)}%` }))

function confirm(): void {
  emit("confirm", {
    inputDeviceId: inputDeviceId.value,
    outputDeviceId: supportsOutput ? outputDeviceId.value : null
  })
  emit("update:modelValue", false)
}

function close(): void {
  emit("update:modelValue", false)
}

onBeforeUnmount(stopStream)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="480"
    persistent
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <v-card rounded="xl" class="media-prepare-card">
      <v-card-title class="media-prepare-title">
        <v-icon icon="mdi-headphones-settings" class="me-2" />
        Audio setup
      </v-card-title>
      <v-card-text>
        <p class="media-prepare-hint">
          Pick a microphone and speaker before joining voice. You can change this later from the audio settings.
        </p>

        <v-alert
          v-if="permissionError"
          type="warning"
          density="comfortable"
          variant="tonal"
          class="media-prepare-alert"
        >
          {{ permissionError }}
        </v-alert>

        <v-select
          v-model="inputDeviceId"
          :items="inputs"
          item-title="label"
          item-value="deviceId"
          label="Microphone"
          density="comfortable"
          variant="solo-filled"
          hide-details
          :disabled="requesting"
        />

        <div class="media-prepare-meter" :aria-label="`Input level ${Math.round(level * 100)}%`">
          <div class="media-prepare-meter-fill" :style="meterStyle" />
        </div>

        <v-select
          v-if="supportsOutput"
          v-model="outputDeviceId"
          :items="outputs"
          item-title="label"
          item-value="deviceId"
          label="Speakers"
          density="comfortable"
          variant="solo-filled"
          hide-details
          class="mt-2"
        />
        <p v-else class="media-prepare-output-hint">
          Your browser does not support choosing an output device — it will use the system default.
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Cancel</v-btn>
        <v-btn color="primary" variant="elevated" :disabled="!inputDeviceId" @click="confirm">
          Join voice
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.media-prepare-card {
  padding: 4px;
}

.media-prepare-title {
  display: flex;
  align-items: center;
}

.media-prepare-hint {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant);
  margin-bottom: 14px;
}

.media-prepare-alert {
  margin-bottom: 12px;
}

.media-prepare-meter {
  margin: 10px 0 6px;
  height: 8px;
  border-radius: 999px;
  background: var(--md-sys-color-surface-container-high);
  overflow: hidden;
}

.media-prepare-meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #facc15 65%, #ef4444 95%);
  transition: width 70ms linear;
}

.media-prepare-output-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}
</style>
