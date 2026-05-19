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
  currentUserId: string
  followedUserId: string | null
}>()

const emit = defineEmits<{
  follow: [userId: string | null]
}>()

function voiceFor(userId: string): MemberVoiceState {
  return props.voiceStateByUserId[userId] ?? {
    micMuted: true,
    deafened: true,
    volume: 0,
    connected: false
  }
}

function isSpeaking(state: MemberVoiceState): boolean {
  if (state.micMuted) return false
  return state.volume > 0.07
}

function volumeLevel(state: MemberVoiceState): number {
  if (state.micMuted) return 0
  return Math.min(1, Math.max(0.12, state.volume))
}

function isFollowing(userId: string): boolean {
  return props.followedUserId === userId
}

function toggleFollow(userId: string): void {
  emit("follow", isFollowing(userId) ? null : userId)
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
        :class="{
          'members-row--speaking': isSpeaking(voiceFor(entry.user.id)),
          'members-row--following': isFollowing(entry.user.id)
        }"
        :title="presenceLabel(entry)"
      >
        <div class="members-avatar-wrap">
          <span
            v-if="!voiceFor(entry.user.id).micMuted"
            class="members-volume-halo"
            :style="{ '--volume-level': volumeLevel(voiceFor(entry.user.id)) }"
          />
          <span
            class="members-avatar"
            :style="{
              backgroundColor: entry.user.color
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
                class="members-voice-icon"
                :class="{ 'members-voice-icon--muted': voiceFor(entry.user.id).micMuted }"
                :icon="voiceFor(entry.user.id).micMuted ? 'mdi-microphone-off' : 'mdi-microphone'"
                size="14"
                :title="voiceFor(entry.user.id).micMuted ? 'Microphone off' : 'Microphone on'"
              />
              <v-icon
                class="members-voice-icon"
                :class="{ 'members-voice-icon--muted': voiceFor(entry.user.id).deafened }"
                :icon="voiceFor(entry.user.id).deafened ? 'mdi-headphones-off' : 'mdi-headphones'"
                size="14"
                :title="voiceFor(entry.user.id).deafened ? 'Speakers off' : 'Speakers on'"
              />
              <span
                v-if="!voiceFor(entry.user.id).micMuted"
                class="members-wave"
                :style="{ '--volume-level': volumeLevel(voiceFor(entry.user.id)) }"
                title="Voice level"
              >
                <span />
                <span />
                <span />
              </span>
            </span>
            <v-tooltip v-if="entry.user.id !== currentUserId" location="top" :text="isFollowing(entry.user.id) ? 'Stop following' : 'Follow'">
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  class="members-follow-btn"
                  :class="{ 'members-follow-btn--active': isFollowing(entry.user.id) }"
                  :icon="isFollowing(entry.user.id) ? 'mdi-eye' : 'mdi-eye-outline'"
                  size="x-small"
                  density="compact"
                  variant="text"
                  @click.stop="toggleFollow(entry.user.id)"
                />
              </template>
            </v-tooltip>
          </div>
          <span class="members-activity">{{ entry.location?.path ?? "Idle" }}</span>
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

.members-row--following {
  background: color-mix(in srgb, var(--md-sys-color-primary) 13%, transparent);
}

.members-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.members-volume-halo {
  --volume-level: 0.12;
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid #4ade80;
  opacity: calc(0.28 + var(--volume-level) * 0.52);
  transform: scale(calc(1 + var(--volume-level) * 0.18));
  transition: opacity 80ms linear, transform 80ms linear;
  pointer-events: none;
}

.members-avatar {
  position: relative;
  z-index: 1;
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
  z-index: 2;
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

.members-wave {
  --volume-level: 0.12;
  width: 18px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #22c55e;
}

.members-wave span {
  width: 3px;
  border-radius: 999px;
  background: currentColor;
  transition: height 80ms linear;
}

.members-wave span:nth-child(1) {
  height: calc(4px + var(--volume-level) * 5px);
}

.members-wave span:nth-child(2) {
  height: calc(6px + var(--volume-level) * 8px);
}

.members-wave span:nth-child(3) {
  height: calc(4px + var(--volume-level) * 6px);
}

.members-follow-btn {
  width: 24px !important;
  height: 24px !important;
  flex-shrink: 0;
  color: var(--md-sys-color-on-surface-variant);
}

.members-follow-btn--active {
  color: var(--md-sys-color-primary);
  background: color-mix(in srgb, var(--md-sys-color-primary) 13%, transparent);
}

.members-activity {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.members-empty {
  list-style: none;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
  padding: 8px 8px;
}
</style>
