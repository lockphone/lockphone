import type { WebSocket } from "ws";
import type { Database } from "./database.js";

export class RealtimeHub {
  private readonly clients = new Set<WebSocket>();

  constructor(private readonly database: Database) {}

  add(socket: WebSocket) {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
  }

  async sendSnapshot(socket?: WebSocket) {
    const frame = JSON.stringify({ type: "snapshot", data: await this.database.publicSnapshot() });
    if (socket) {
      if (socket.readyState === socket.OPEN) socket.send(frame);
      return;
    }
    for (const client of this.clients) {
      if (client.readyState === client.OPEN) client.send(frame);
    }
  }
}

