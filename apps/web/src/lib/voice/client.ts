import { Device, types as msTypes } from "mediasoup-client"

type Consumer = msTypes.Consumer
type Producer = msTypes.Producer
type Transport = msTypes.Transport
type TransportOptions = msTypes.TransportOptions
type MediaKind = msTypes.MediaKind
type RtpCapabilities = msTypes.RtpCapabilities
type RtpParameters = msTypes.RtpParameters

export type VoicePeer = {
  peerId: string
  userId: string
  displayName: string
  hasAudio: boolean
  micMuted: boolean
  deafened: boolean
  volume: number
}

export type VoiceClientEvents = {
  onConnectedChange: (value: boolean) => void
  onPeersChange: (peers: VoicePeer[]) => void
  onMicPublishingChange: (publishing: boolean) => void
  onError: (message: string) => void
}

type PendingRequest = {
  resolve: (data: Record<string, unknown>) => void
  reject: (error: Error) => void
  timeout: number
}

type PublicPeer = {
  peerId: string
  userId: string
  displayName: string
  micMuted: boolean
  deafened: boolean
}

type WelcomeMessage = {
  type: "welcome"
  selfPeerId: string
  rtpCapabilities: RtpCapabilities
  peers: Array<
    PublicPeer & {
      producers: Array<{ producerId: string; kind: MediaKind }>
    }
  >
}

type PeerJoinedMessage = { type: "peerJoined" } & PublicPeer
type PeerStateChangedMessage = {
  type: "peerStateChanged"
  peerId: string
  micMuted: boolean
  deafened: boolean
}
type PeerLeftMessage = { type: "peerLeft"; peerId: string }
type NewProducerMessage = {
  type: "newProducer"
  peerId: string
  producerId: string
  kind: MediaKind
}
type ProducerClosedMessage = {
  type: "producerClosed"
  peerId: string
  producerId: string
}
type ConsumerClosedMessage = { type: "consumerClosed"; consumerId: string }
type ResponseMessage = {
  id: string
  ok: boolean
  data?: Record<string, unknown>
  error?: string
}
type NotificationMessage =
  | WelcomeMessage
  | PeerJoinedMessage
  | PeerStateChangedMessage
  | PeerLeftMessage
  | NewProducerMessage
  | ProducerClosedMessage
  | ConsumerClosedMessage

const REQUEST_TIMEOUT_MS = 15_000
const VOLUME_TICK_MS = 80
const VOLUME_DECAY = 0.55

type VolumeMonitor = {
  context: AudioContext
  source: MediaStreamAudioSourceNode
  analyser: AnalyserNode
  buffer: Uint8Array<ArrayBuffer>
  level: number
}

export class VoiceClient {
  private socket: WebSocket | null = null
  private device: Device | null = null
  private sendTransport: Transport | null = null
  private recvTransport: Transport | null = null
  private producer: Producer | null = null
  private consumers = new Map<string, Consumer>()
  private consumerByProducer = new Map<string, string>()
  private consumerServerPaused = new Map<string, boolean>()
  private peerAudio = new Map<string, HTMLAudioElement>()
  private volumeMonitors = new Map<string, VolumeMonitor>()
  private volumeTimer: number | null = null
  private pending = new Map<string, PendingRequest>()
  private peers = new Map<string, VoicePeer>()
  private peerProducers = new Map<string, Set<string>>()
  private selfPeerId: string | null = null
  private destroyed = false
  private micMuted = true
  private deafened = true
  private preferredOutputDeviceId: string | null = null

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly workspaceId: string,
    private readonly events: VoiceClientEvents
  ) {}

  async connect(): Promise<void> {
    if (this.socket) return
    const url = new URL(this.url)
    url.searchParams.set("token", this.token)
    url.searchParams.set("workspaceId", this.workspaceId)

    const socket = new WebSocket(url.toString())
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener("error", onError)
        resolve()
      }
      const onError = () => {
        socket.removeEventListener("open", onOpen)
        reject(new Error("Voice socket failed to open"))
      }
      socket.addEventListener("open", onOpen, { once: true })
      socket.addEventListener("error", onError, { once: true })
    })

    socket.addEventListener("message", (event) => {
      void this.handleMessage(event.data)
    })
    socket.addEventListener("close", () => this.handleClose())
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.stopVolumeLoop()
    this.producer?.close()
    this.producer = null
    for (const consumer of this.consumers.values()) consumer.close()
    this.consumers.clear()
    this.consumerByProducer.clear()
    this.consumerServerPaused.clear()
    for (const monitor of this.volumeMonitors.values()) {
      this.disposeVolumeMonitor(monitor)
    }
    this.volumeMonitors.clear()
    for (const el of this.peerAudio.values()) {
      el.pause()
      el.srcObject = null
      el.remove()
    }
    this.peerAudio.clear()
    this.sendTransport?.close()
    this.recvTransport?.close()
    this.sendTransport = null
    this.recvTransport = null
    this.device = null
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      this.socket.close()
    }
    this.socket = null
    this.peers.clear()
    this.peerProducers.clear()
    this.events.onConnectedChange(false)
    this.events.onPeersChange([])
    this.events.onMicPublishingChange(false)
  }

  async setDeafened(value: boolean): Promise<void> {
    this.deafened = value
    for (const [consumerId] of this.consumers) {
      const currentlyPaused = this.consumerServerPaused.get(consumerId) ?? true
      if (value && !currentlyPaused) {
        await this.request("pauseConsumer", { consumerId }).catch(() => {})
        this.consumerServerPaused.set(consumerId, true)
      } else if (!value && currentlyPaused) {
        await this.request("resumeConsumer", { consumerId }).catch(() => {})
        this.consumerServerPaused.set(consumerId, false)
      }
    }
    for (const el of this.peerAudio.values()) {
      el.muted = value
    }
    void this.request("setState", { deafened: value, micMuted: this.micMuted }).catch(() => {})
  }

  async setMicMuted(value: boolean): Promise<void> {
    this.micMuted = value
    if (this.producer) {
      if (value && !this.producer.paused) {
        this.producer.pause()
      } else if (!value && this.producer.paused) {
        this.producer.resume()
      }
      const producerId = this.producer.id
      void this.request(value ? "pauseProducer" : "resumeProducer", { producerId }).catch(() => {})
    }
    void this.request("setState", { micMuted: value, deafened: this.deafened }).catch(() => {})
  }

  async enableMic(inputDeviceId: string | null): Promise<void> {
    if (this.producer) {
      if (this.producer.paused) this.producer.resume()
      this.micMuted = false
      void this.request("setState", { micMuted: false, deafened: this.deafened }).catch(() => {})
      this.events.onMicPublishingChange(true)
      return
    }
    if (!this.device || !this.device.loaded) {
      throw new Error("Voice device not ready")
    }
    if (!this.sendTransport) {
      this.sendTransport = await this.createTransport("send")
    }

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
    if (inputDeviceId && inputDeviceId !== "default") {
      audioConstraints.deviceId = { exact: inputDeviceId }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
    const track = stream.getAudioTracks()[0]
    if (!track) {
      throw new Error("No audio track")
    }

    const producer = await this.sendTransport.produce({
      track,
      codecOptions: {
        opusStereo: false,
        opusDtx: true,
        opusFec: true
      }
    })
    this.producer = producer
    this.micMuted = false
    producer.on("transportclose", () => {
      this.producer = null
      this.events.onMicPublishingChange(false)
    })
    producer.on("trackended", () => {
      void this.disableMic()
    })
    this.events.onMicPublishingChange(true)
    void this.request("setState", { micMuted: false, deafened: this.deafened }).catch(() => {})
  }

  async disableMic(): Promise<void> {
    const producer = this.producer
    this.micMuted = true
    if (!producer) {
      void this.request("setState", { micMuted: true, deafened: this.deafened }).catch(() => {})
      return
    }
    this.producer = null
    try {
      producer.track?.stop()
      producer.close()
      await this.request("closeProducer", { producerId: producer.id })
    } catch {
      // ignore
    }
    this.events.onMicPublishingChange(false)
    void this.request("setState", { micMuted: true, deafened: this.deafened }).catch(() => {})
  }

  async setPreferredOutputDevice(deviceId: string | null): Promise<void> {
    this.preferredOutputDeviceId = deviceId
    if (!deviceId) return
    for (const el of this.peerAudio.values()) {
      await applySinkId(el, deviceId)
    }
  }

  private async handleMessage(raw: unknown): Promise<void> {
    if (typeof raw !== "string") return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }

    if (typeof parsed["id"] === "string") {
      this.resolveRequest(parsed as ResponseMessage)
      return
    }

    const message = parsed as NotificationMessage
    switch (message.type) {
      case "welcome":
        await this.handleWelcome(message)
        return
      case "peerJoined":
        this.upsertPeer({
          peerId: message.peerId,
          userId: message.userId,
          displayName: message.displayName,
          hasAudio: false,
          micMuted: message.micMuted,
          deafened: message.deafened,
          volume: 0
        })
        return
      case "peerStateChanged":
        this.patchPeer(message.peerId, {
          micMuted: message.micMuted,
          deafened: message.deafened
        })
        return
      case "peerLeft":
        this.removePeer(message.peerId)
        return
      case "newProducer":
        await this.consumeProducer(message.peerId, message.producerId)
        return
      case "producerClosed":
        this.handleProducerClosed(message.peerId, message.producerId)
        return
      case "consumerClosed":
        this.handleConsumerClosed(message.consumerId)
        return
    }
  }

  private async handleWelcome(message: WelcomeMessage): Promise<void> {
    this.selfPeerId = message.selfPeerId
    this.device = new Device()
    await this.device.load({ routerRtpCapabilities: message.rtpCapabilities })
    this.recvTransport = await this.createTransport("recv")
    this.events.onConnectedChange(true)

    for (const peer of message.peers) {
      this.upsertPeer({
        peerId: peer.peerId,
        userId: peer.userId,
        displayName: peer.displayName,
        hasAudio: peer.producers.length > 0,
        micMuted: peer.micMuted,
        deafened: peer.deafened,
        volume: 0
      })
      for (const producer of peer.producers) {
        await this.consumeProducer(peer.peerId, producer.producerId)
      }
    }

    void this.request("setState", { micMuted: this.micMuted, deafened: this.deafened }).catch(() => {})
  }

  private async createTransport(direction: "send" | "recv"): Promise<Transport> {
    if (!this.device) throw new Error("Device not loaded")
    const data = await this.request("createTransport", { direction })
    const options: TransportOptions = {
      id: data["transportId"] as string,
      iceParameters: data["iceParameters"] as TransportOptions["iceParameters"],
      iceCandidates: data["iceCandidates"] as TransportOptions["iceCandidates"],
      dtlsParameters: data["dtlsParameters"] as TransportOptions["dtlsParameters"]
    }
    const iceServers = data["iceServers"] as RTCIceServer[] | undefined
    if (iceServers && iceServers.length > 0) {
      options.iceServers = iceServers
    }
    const transport =
      direction === "send" ? this.device.createSendTransport(options) : this.device.createRecvTransport(options)

    transport.on("connect", ({ dtlsParameters }, callback, errback) => {
      this.request("connectTransport", { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch((error) => errback(error instanceof Error ? error : new Error(String(error))))
    })

    if (direction === "send") {
      transport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
        this.request("produce", {
          transportId: transport.id,
          kind: kind as MediaKind,
          rtpParameters: rtpParameters as RtpParameters
        })
          .then((response) => callback({ id: response["producerId"] as string }))
          .catch((error) => errback(error instanceof Error ? error : new Error(String(error))))
      })
    }

    return transport
  }

  private async consumeProducer(peerId: string, producerId: string): Promise<void> {
    if (!this.device || !this.recvTransport) return
    if (this.consumerByProducer.has(producerId)) return

    try {
      const data = await this.request("consume", {
        producerId,
        transportId: this.recvTransport.id,
        rtpCapabilities: this.device.rtpCapabilities
      })
      if (data["skipped"]) return
      const consumer = await this.recvTransport.consume({
        id: data["consumerId"] as string,
        producerId,
        kind: data["kind"] as MediaKind,
        rtpParameters: data["rtpParameters"] as RtpParameters
      })
      this.consumers.set(consumer.id, consumer)
      this.consumerByProducer.set(producerId, consumer.id)
      this.consumerServerPaused.set(consumer.id, true)

      consumer.on("transportclose", () => {
        this.consumers.delete(consumer.id)
        this.consumerByProducer.delete(producerId)
        this.consumerServerPaused.delete(consumer.id)
      })

      this.attachAudio(peerId, consumer)
      this.markPeerProducer(peerId, producerId, true)

      if (!this.deafened) {
        await this.request("resumeConsumer", { consumerId: consumer.id }).catch(() => {})
        this.consumerServerPaused.set(consumer.id, false)
      }
    } catch (error) {
      this.events.onError(error instanceof Error ? error.message : "Failed to consume")
    }
  }

  private attachAudio(peerId: string, consumer: Consumer): void {
    let element = this.peerAudio.get(peerId)
    if (!element) {
      element = document.createElement("audio")
      element.autoplay = true
      element.setAttribute("playsinline", "true")
      element.style.display = "none"
      document.body.appendChild(element)
      this.peerAudio.set(peerId, element)
      if (this.preferredOutputDeviceId) {
        void applySinkId(element, this.preferredOutputDeviceId)
      }
    }
    const stream = new MediaStream([consumer.track])
    element.srcObject = stream
    element.muted = this.deafened
    element.play().catch(() => {})
    this.attachVolumeMonitor(peerId, stream)
  }

  private attachVolumeMonitor(peerId: string, stream: MediaStream): void {
    this.disposePeerVolumeMonitor(peerId)
    try {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.4
      source.connect(analyser)
      this.volumeMonitors.set(peerId, {
        context,
        source,
        analyser,
        buffer: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
        level: 0
      })
      this.startVolumeLoop()
    } catch {
      // AudioContext can fail before user gesture; element.play() above unlocks it.
    }
  }

  private startVolumeLoop(): void {
    if (this.volumeTimer !== null) return
    const tick = () => {
      if (this.destroyed) return
      let changed = false
      for (const [peerId, monitor] of this.volumeMonitors) {
        monitor.analyser.getByteTimeDomainData(monitor.buffer)
        let sumSquares = 0
        for (const sample of monitor.buffer) {
          const normalized = (sample - 128) / 128
          sumSquares += normalized * normalized
        }
        const rms = Math.sqrt(sumSquares / monitor.buffer.length)
        const next = Math.min(1, rms * 2.5)
        const smoothed = Math.max(next, monitor.level * VOLUME_DECAY)
        if (Math.abs(smoothed - monitor.level) > 0.02) {
          monitor.level = smoothed
          const peer = this.peers.get(peerId)
          if (peer) {
            this.peers.set(peerId, { ...peer, volume: smoothed })
            changed = true
          }
        }
      }
      if (changed) this.emitPeers()
      this.volumeTimer = window.setTimeout(tick, VOLUME_TICK_MS)
    }
    this.volumeTimer = window.setTimeout(tick, VOLUME_TICK_MS)
  }

  private stopVolumeLoop(): void {
    if (this.volumeTimer !== null) {
      window.clearTimeout(this.volumeTimer)
      this.volumeTimer = null
    }
  }

  private disposePeerVolumeMonitor(peerId: string): void {
    const monitor = this.volumeMonitors.get(peerId)
    if (!monitor) return
    this.disposeVolumeMonitor(monitor)
    this.volumeMonitors.delete(peerId)
  }

  private disposeVolumeMonitor(monitor: VolumeMonitor): void {
    try {
      monitor.source.disconnect()
      monitor.analyser.disconnect()
      if (monitor.context.state !== "closed") void monitor.context.close()
    } catch {
      // ignore
    }
  }

  private handleProducerClosed(peerId: string, producerId: string): void {
    const consumerId = this.consumerByProducer.get(producerId)
    if (consumerId) {
      this.handleConsumerClosed(consumerId)
    }
    this.markPeerProducer(peerId, producerId, false)
  }

  private handleConsumerClosed(consumerId: string): void {
    const consumer = this.consumers.get(consumerId)
    if (!consumer) return
    let producerId: string | null = null
    for (const [pid, cid] of this.consumerByProducer) {
      if (cid === consumerId) {
        producerId = pid
        break
      }
    }
    consumer.close()
    this.consumers.delete(consumerId)
    this.consumerServerPaused.delete(consumerId)
    if (producerId) this.consumerByProducer.delete(producerId)

    let peerId: string | null = null
    for (const [pid, set] of this.peerProducers) {
      if (producerId && set.has(producerId)) {
        peerId = pid
        break
      }
    }
    if (peerId) {
      const element = this.peerAudio.get(peerId)
      const remaining = this.peerProducers.get(peerId)
      if (remaining && producerId) remaining.delete(producerId)
      if (element && (!remaining || remaining.size === 0)) {
        element.pause()
        element.srcObject = null
        element.remove()
        this.peerAudio.delete(peerId)
        this.disposePeerVolumeMonitor(peerId)
      }
      this.refreshPeerHasAudio(peerId)
    }
  }

  private markPeerProducer(peerId: string, producerId: string, present: boolean): void {
    let set = this.peerProducers.get(peerId)
    if (!set) {
      set = new Set()
      this.peerProducers.set(peerId, set)
    }
    if (present) set.add(producerId)
    else set.delete(producerId)
    this.refreshPeerHasAudio(peerId)
  }

  private refreshPeerHasAudio(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return
    const set = this.peerProducers.get(peerId)
    const next: VoicePeer = { ...peer, hasAudio: !!set && set.size > 0 }
    this.peers.set(peerId, next)
    this.emitPeers()
  }

  private patchPeer(peerId: string, patch: Partial<VoicePeer>): void {
    const peer = this.peers.get(peerId)
    if (!peer) return
    this.peers.set(peerId, { ...peer, ...patch })
    this.emitPeers()
  }

  private upsertPeer(peer: VoicePeer): void {
    this.peers.set(peer.peerId, peer)
    this.emitPeers()
  }

  private removePeer(peerId: string): void {
    this.peers.delete(peerId)
    this.peerProducers.delete(peerId)
    const element = this.peerAudio.get(peerId)
    if (element) {
      element.pause()
      element.srcObject = null
      element.remove()
      this.peerAudio.delete(peerId)
    }
    this.disposePeerVolumeMonitor(peerId)
    this.emitPeers()
  }

  private emitPeers(): void {
    const list: VoicePeer[] = []
    for (const peer of this.peers.values()) {
      if (peer.peerId === this.selfPeerId) continue
      list.push(peer)
    }
    this.events.onPeersChange(list)
  }

  private handleClose(): void {
    if (this.destroyed) return
    this.events.onConnectedChange(false)
    this.destroy()
  }

  private request(type: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("Voice socket closed"))
        return
      }
      const id = crypto.randomUUID()
      const timeout = window.setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Voice request '${type}' timed out`))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ id, type, data: data ?? {} }))
    })
  }

  private resolveRequest(message: ResponseMessage): void {
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    window.clearTimeout(pending.timeout)
    if (message.ok) {
      pending.resolve(message.data ?? {})
    } else {
      pending.reject(new Error(message.error ?? "Voice request failed"))
    }
  }
}

async function applySinkId(element: HTMLAudioElement, deviceId: string): Promise<void> {
  const target = element as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
  if (typeof target.setSinkId !== "function") return
  try {
    await target.setSinkId(deviceId)
  } catch {
    // ignore — browser may refuse
  }
}
