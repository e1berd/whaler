<script setup lang="ts">
import type { AwarenessUser, FileLocation } from "@whaler/shared"

type PresenceEntry = {
  user: AwarenessUser
  location?: FileLocation
}

export type MemberVoiceState = {
  micMuted: boolean
  deafened: boolean
  volume: number
  connected: boolean
  speaking?: boolean
}

const props = defineProps<{
  presenceList: PresenceEntry[]
  presenceLabel: (entry: PresenceEntry) => string
  voiceStateByUserId: Record<string, MemberVoiceState>
}>()

function voiceFor(userId: string): MemberVoiceState | null {
  return props.voiceStateByUserId[userId] ?? null
}

function isSpeaking(state: MemberVoiceState | null): boolean {
  if (!state) return false
  if (state.micMuted) return false
  return state.volume > 0.07
}

function volumePercent(state: MemberVoiceState | null): number {
  if (!state || state.micMuted) return 0
  return Math.round(Math.min(1, state.volume) * 100)
}
</script>

<template>
  <section class="members-panel">
    <header class="members-heading">
      <span class="members-title">Online — {{ presenceList.length }}</span>
    </header>
    <ul class="members-list">
      <li
        v-for="entry in presenceList"
        :key="entry.user.id"
        class="members-row"
        :class="{ 'members-row--speaking': isSpeaking(voiceFor(entry.user.id)) }"
        :title="presenceLabel(entry)"
      >
        <div class="members-avatar-wrap">
          <span
            class="members-avatar"
            :style="{
              backgroundColor: entry.user.color,
              boxShadow: isSpeaking(voiceFor(entry.user.id))
                ? `0 0 0 2px var(--md-sys-color-success, #4ade80)`
                : undefined
            }"
          >
            <img v-if="entry.user.avatarUrl" :src="entry.user.avatarUrl" :alt="entry.user.name" />
            <template v-else>{{ entry.user.name.charAt(0).toUpperCase() }}</template>
          </span>
          <span class="members-status-dot" />
        </div>
        <div class="members-text">
          <div class="members-name-row">
            <span class="members-name">{{ entry.user.name }}</span>
            <span class="members-voice-icons">
              <v-icon
                v-if="voiceFor(entry.user.id)?.micMuted"
                class="members-voice-icon members-voice-icon--muted"
                icon="mdi-microphone-off"
                size="14"
                title="Microphone off"
              />
              <v-icon
                v-if="voiceFor(entry.user.id)?.deafened"
                class="members-voice-icon members-voice-icon--muted"
                icon="mdi-headphones-off"
                size="14"
                title="Speakers off"
              />
            </span>
          </div>
          <div
            v-if="!voiceFor(entry.user.id)?.micMuted && voiceFor(entry.user.id)"
            class="members-volume"
            :style="{ '--level': `${volumePercent(voiceFor(entry.user.id))}%` }"
          />
          <span v-else class="members-activity">{{ entry.location?.path ?? "Idle" }}</span>
        </div>
      </li>
      <li v-if="!presenceList.length" class="members-empty">No one else is here.</li>
    </ul>
  </section>
</template>

<style scoped>
.members-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  gap: 6px;
  padding-top: 4px;
}

.members-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 6px;
}

.members-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
}

.members-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.members-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: default;
  min-height: 38px;
  transition: background 120ms cubic-bezier(0.2, 0, 0, 1);
}

.members-row:hover {
  background: color-mix(in srgb, var(--md-sys-color-primary) 8%, transparent);
}

.members-row--speaking {
  background: color-mix(in srgb, var(--md-sys-color-success-container, #34d399) 18%, transparent);
}

.members-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.members-avatar {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  transition: box-shadow 120ms ease;
}

.members-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.members-status-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #4ade80;
  border: 2px solid var(--md-sys-color-surface-container-low);
  box-sizing: content-box;
}

.members-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  gap: 2px;
}

.members-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.members-name {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--md-sys-color-on-surface);
  flex: 1;
  min-width: 0;
}

.members-voice-icons {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.members-voice-icon {
  color: var(--md-sys-color-on-surface-variant);
}

.members-voice-icon--muted {
  color: rgb(var(--v-theme-error));
}

.members-activity {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.members-volume {
  --level: 0%;
  height: 4px;
  border-radius: 999px;
  background: var(--md-sys-color-surface-container-highest, rgba(255, 255, 255, 0.08));
  overflow: hidden;
  position: relative;
}

.members-volume::after {
  content: "";
  position: absolute;
  inset: 0;
  width: var(--level);
  background: linear-gradient(90deg, #4ade80, #facc15 70%, #ef4444 95%);
  transition: width 80ms linear;
}

.members-empty {
  list-style: none;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px 8px;
}
</style>
