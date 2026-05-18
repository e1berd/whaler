import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"
import { voiceUrl } from "@/lib/config"
import { VoiceClient, type VoicePeer } from "./client"
import {
  loadPreferredInputDevice,
  loadPreferredOutputDevice,
  savePreferredInputDevice,
  savePreferredOutputDevice
} from "./devices"

export type VoiceComposable = ReturnType<typeof useVoice>

export function useVoice(options: {
  workspaceId: Ref<string>
  accessToken: Ref<string>
}) {
  const connected = ref(false)
  const micPublishing = ref(false)
  const micMuted = ref(true)
  const deafened = ref(true)
  const peers = shallowRef<VoicePeer[]>([])
  const error = ref<string | null>(null)
  const inputDeviceId = ref<string | null>(loadPreferredInputDevice())
  const outputDeviceId = ref<string | null>(loadPreferredOutputDevice())

  let client: VoiceClient | null = null
  let connecting: Promise<void> | null = null

  function teardown(): void {
    if (client) {
      client.destroy()
      client = null
    }
    connected.value = false
    micPublishing.value = false
    peers.value = []
  }

  async function ensureConnected(): Promise<VoiceClient | null> {
    if (client) return client
    if (connecting) {
      await connecting
      return client
    }
    if (!options.workspaceId.value || !options.accessToken.value) return null

    const instance = new VoiceClient(
      voiceUrl(),
      options.accessToken.value,
      options.workspaceId.value,
      {
        onConnectedChange: (value) => {
          connected.value = value
        },
        onPeersChange: (next) => {
          peers.value = next
        },
        onMicPublishingChange: (value) => {
          micPublishing.value = value
        },
        onError: (message) => {
          error.value = message
        }
      }
    )
    connecting = (async () => {
      try {
        await instance.connect()
        client = instance
        await instance.setDeafened(deafened.value)
        if (outputDeviceId.value) {
          await instance.setPreferredOutputDevice(outputDeviceId.value)
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : "Voice connect failed"
        instance.destroy()
      } finally {
        connecting = null
      }
    })()
    await connecting
    return client
  }

  async function enableMic(): Promise<void> {
    error.value = null
    const instance = await ensureConnected()
    if (!instance) return
    try {
      await instance.enableMic(inputDeviceId.value)
      micMuted.value = false
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Microphone not available"
      throw err
    }
  }

  async function disableMic(): Promise<void> {
    if (!client) {
      micMuted.value = true
      return
    }
    await client.disableMic()
    micMuted.value = true
  }

  async function toggleMicMute(): Promise<void> {
    if (!client || !micPublishing.value) {
      await enableMic()
      return
    }
    const next = !micMuted.value
    await client.setMicMuted(next)
    micMuted.value = next
  }

  async function setDeafened(value: boolean): Promise<void> {
    deafened.value = value
    if (!value) {
      const instance = await ensureConnected()
      if (instance) await instance.setDeafened(false)
    } else if (client) {
      await client.setDeafened(true)
    }
  }

  async function toggleDeafen(): Promise<void> {
    await setDeafened(!deafened.value)
  }

  function setInputDevice(deviceId: string | null): void {
    inputDeviceId.value = deviceId
    savePreferredInputDevice(deviceId)
  }

  async function setOutputDevice(deviceId: string | null): Promise<void> {
    outputDeviceId.value = deviceId
    savePreferredOutputDevice(deviceId)
    if (client) await client.setPreferredOutputDevice(deviceId)
  }

  watch(
    () => [options.workspaceId.value, options.accessToken.value],
    () => {
      teardown()
    }
  )

  onBeforeUnmount(teardown)

  return {
    connected,
    micPublishing,
    micMuted,
    deafened,
    peers,
    error,
    inputDeviceId,
    outputDeviceId,
    ensureConnected,
    enableMic,
    disableMic,
    toggleMicMute,
    toggleDeafen,
    setDeafened,
    setInputDevice,
    setOutputDevice,
    teardown
  }
}
