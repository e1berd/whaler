export type DeviceOption = {
  deviceId: string
  label: string
}

const INPUT_KEY = "whaler.voice.input"
const OUTPUT_KEY = "whaler.voice.output"

export function loadPreferredInputDevice(): string | null {
  return localStorage.getItem(INPUT_KEY)
}

export function loadPreferredOutputDevice(): string | null {
  return localStorage.getItem(OUTPUT_KEY)
}

export function savePreferredInputDevice(value: string | null): void {
  if (value) localStorage.setItem(INPUT_KEY, value)
  else localStorage.removeItem(INPUT_KEY)
}

export function savePreferredOutputDevice(value: string | null): void {
  if (value) localStorage.setItem(OUTPUT_KEY, value)
  else localStorage.removeItem(OUTPUT_KEY)
}

export async function listAudioDevices(): Promise<{ inputs: DeviceOption[]; outputs: DeviceOption[] }> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] }
  }
  const devices = await navigator.mediaDevices.enumerateDevices()
  const inputs: DeviceOption[] = []
  const outputs: DeviceOption[] = []
  for (const device of devices) {
    const option: DeviceOption = {
      deviceId: device.deviceId,
      label: device.label || (device.kind === "audioinput" ? "Microphone" : "Speaker")
    }
    if (device.kind === "audioinput") inputs.push(option)
    else if (device.kind === "audiooutput") outputs.push(option)
  }
  return { inputs, outputs }
}

export async function requestMicrophonePermission(deviceId: string | null): Promise<MediaStream> {
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
  if (deviceId && deviceId !== "default") {
    constraints.deviceId = { exact: deviceId }
  }
  return await navigator.mediaDevices.getUserMedia({ audio: constraints, video: false })
}

export function supportsOutputSelection(): boolean {
  if (typeof window === "undefined") return false
  return typeof (HTMLAudioElement.prototype as { setSinkId?: unknown }).setSinkId === "function"
}
