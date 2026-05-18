import type { types } from "mediasoup"
import { env } from "./env"
import { audioCodecs, pickWorker } from "./worker"

type Router = types.Router
type WebRtcTransport = types.WebRtcTransport
type Producer = types.Producer
type Consumer = types.Consumer
type DtlsParameters = types.DtlsParameters
type MediaKind = types.MediaKind
type RtpParameters = types.RtpParameters
type RtpCapabilities = types.RtpCapabilities

export type Peer = {
  id: string
  userId: string
  displayName: string
  micMuted: boolean
  deafened: boolean
  socketSend: (payload: unknown) => void
  transports: Map<string, WebRtcTransport>
  producers: Map<string, Producer>
  consumers: Map<string, Consumer>
}

const rooms = new Map<string, Room>()
const pending = new Map<string, Promise<Room>>()

export class Room {
  readonly id: string
  readonly router: Router
  readonly peers = new Map<string, Peer>()

  constructor(id: string, router: Router) {
    this.id = id
    this.router = router
  }

  static async getOrCreate(workspaceId: string): Promise<Room> {
    const existing = rooms.get(workspaceId)
    if (existing) return existing
    const inflight = pending.get(workspaceId)
    if (inflight) return inflight

    const promise = (async () => {
      const worker = pickWorker()
      const router = await worker.createRouter({ mediaCodecs: audioCodecs })
      const room = new Room(workspaceId, router)
      rooms.set(workspaceId, room)
      return room
    })()
    pending.set(workspaceId, promise)
    try {
      return await promise
    } finally {
      pending.delete(workspaceId)
    }
  }

  addPeer(peer: Peer): void {
    this.peers.set(peer.id, peer)
  }

  removePeer(peerId: string): void {
    const peer = this.peers.get(peerId)
    if (!peer) return
    for (const consumer of peer.consumers.values()) consumer.close()
    for (const producer of peer.producers.values()) producer.close()
    for (const transport of peer.transports.values()) transport.close()
    this.peers.delete(peerId)
    if (this.peers.size === 0) {
      this.router.close()
      rooms.delete(this.id)
    }
  }

  async createTransport(peer: Peer): Promise<WebRtcTransport> {
    const listenInfo: {
      protocol: "udp" | "tcp"
      ip: string
      announcedAddress?: string
    } = {
      protocol: "udp",
      ip: env.mediasoup.listenIp
    }
    if (env.mediasoup.announcedIp) listenInfo.announcedAddress = env.mediasoup.announcedIp
    const tcpInfo: typeof listenInfo = { ...listenInfo, protocol: "tcp" }

    const transport = await this.router.createWebRtcTransport({
      listenInfos: [listenInfo, tcpInfo],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 600_000
    })
    transport.on("dtlsstatechange", (state) => {
      if (state === "closed" || state === "failed") transport.close()
    })
    peer.transports.set(transport.id, transport)
    return transport
  }

  async connectTransport(peer: Peer, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    const transport = peer.transports.get(transportId)
    if (!transport) throw new Error("Transport not found")
    await transport.connect({ dtlsParameters })
  }

  async produce(
    peer: Peer,
    transportId: string,
    kind: MediaKind,
    rtpParameters: RtpParameters
  ): Promise<Producer> {
    const transport = peer.transports.get(transportId)
    if (!transport) throw new Error("Transport not found")
    const producer = await transport.produce({ kind, rtpParameters })
    peer.producers.set(producer.id, producer)
    producer.on("transportclose", () => {
      peer.producers.delete(producer.id)
    })
    return producer
  }

  async consume(
    peer: Peer,
    producer: Producer,
    transportId: string,
    rtpCapabilities: RtpCapabilities
  ): Promise<Consumer | null> {
    if (!this.router.canConsume({ producerId: producer.id, rtpCapabilities })) {
      return null
    }
    const transport = peer.transports.get(transportId)
    if (!transport) throw new Error("Recv transport not found")
    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true
    })
    peer.consumers.set(consumer.id, consumer)
    consumer.on("transportclose", () => peer.consumers.delete(consumer.id))
    consumer.on("producerclose", () => {
      peer.consumers.delete(consumer.id)
      peer.socketSend({ type: "consumerClosed", consumerId: consumer.id })
    })
    return consumer
  }

  findProducerOwner(producerId: string): Peer | null {
    for (const peer of this.peers.values()) {
      if (peer.producers.has(producerId)) return peer
    }
    return null
  }

  broadcast(except: string, message: unknown): void {
    for (const peer of this.peers.values()) {
      if (peer.id === except) continue
      peer.socketSend(message)
    }
  }
}
