import type { WebSocket } from "ws";
import type { FastifyRequest } from "fastify";

export type SubscriptionChannel =
  | "trades"
  | "evolution"
  | "strategies"
  | "prices"
  | "positions"
  | "all";

interface ClientConnection {
  id: string;
  socket: WebSocket;
  subscriptions: Set<SubscriptionChannel>;
}

interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "ping";
  channels?: SubscriptionChannel[];
}

export class WebSocketHandler {
  private clients: Map<string, ClientConnection> = new Map();
  private clientIdCounter = 0;

  handleConnection(socket: WebSocket, request: FastifyRequest): void {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;
    console.log(`[WS] Creating client ${clientId}`);

    const client: ClientConnection = {
      id: clientId,
      socket,
      subscriptions: new Set(["all"]),
    };

    this.clients.set(clientId, client);
    console.log(`[WS] Client ${clientId} added, total clients: ${this.clients.size}`);

    console.log(`[WS] Socket readyState: ${socket.readyState}`);
    
    this.send(socket, {
      type: "connected",
      clientId,
      message: "Connected to $META WebSocket server",
    });
    console.log(`[WS] Sent connected message to ${clientId}`);

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(client, message);
      } catch (err) {
        this.send(socket, { type: "error", message: "Invalid JSON" });
      }
    });

    socket.on("close", (code, reason) => {
      console.log(`[WS] Client ${clientId} disconnected, code: ${code}, reason: ${reason?.toString()}`);
      this.clients.delete(clientId);
    });

    socket.on("error", (err) => {
      console.error(`[WS] Client ${clientId} error:`, err);
      this.clients.delete(clientId);
    });
  }

  private handleMessage(client: ClientConnection, message: WebSocketMessage): void {
    switch (message.type) {
      case "subscribe":
        if (message.channels) {
          for (const channel of message.channels) {
            client.subscriptions.add(channel);
          }
          this.send(client.socket, {
            type: "subscribed",
            channels: Array.from(client.subscriptions),
          });
        }
        break;

      case "unsubscribe":
        if (message.channels) {
          for (const channel of message.channels) {
            client.subscriptions.delete(channel);
          }
          this.send(client.socket, {
            type: "unsubscribed",
            channels: Array.from(client.subscriptions),
          });
        }
        break;

      case "ping":
        this.send(client.socket, { type: "pong", timestamp: Date.now() });
        break;
    }
  }

  broadcast(event: string, data: unknown): void {
    const channel = this.getChannelForEvent(event);
    const payload = JSON.stringify({ type: event, data, timestamp: Date.now() });

    for (const client of this.clients.values()) {
      if (
        client.socket.readyState === 1 &&
        (client.subscriptions.has("all") || client.subscriptions.has(channel))
      ) {
        client.socket.send(payload);
      }
    }
  }

  private getChannelForEvent(event: string): SubscriptionChannel {
    if (event.startsWith("trade:") || event.startsWith("position:")) {
      return "trades";
    }
    if (event.startsWith("evolution:") || event.startsWith("strategy:")) {
      return "evolution";
    }
    if (event.startsWith("token:") || event.startsWith("price:")) {
      return "prices";
    }
    return "all";
  }

  private send(socket: WebSocket, data: Record<string, unknown>): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(data));
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }

  broadcastToChannel(channel: SubscriptionChannel, event: string, data: unknown): void {
    const payload = JSON.stringify({ type: event, data, timestamp: Date.now() });

    for (const client of this.clients.values()) {
      if (
        client.socket.readyState === 1 &&
        (client.subscriptions.has("all") || client.subscriptions.has(channel))
      ) {
        client.socket.send(payload);
      }
    }
  }
}
