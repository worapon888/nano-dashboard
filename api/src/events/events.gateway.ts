import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import {
  EventPayload,
  MarketEventsPublisher,
  UserEventsPublisher,
  WsConnectionsProvider,
} from './events.tokens';

/**
 * Pure-WS gateway that broadcasts domain events to all connected clients.
 *
 * Message envelope: `{ event: string, data: unknown }`
 *
 * Supported events:
 *   user.created   – emitted after a new user is registered
 *   user.updated   – emitted after a user record is mutated
 *   ticker:<SYMBOL>– emitted after a fresh Binance ticker is fetched and cached
 */
@WebSocketGateway({ path: '/ws' })
export class EventsGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    UserEventsPublisher,
    MarketEventsPublisher,
    WsConnectionsProvider
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectionCount = 0;

  afterInit(_server: Server): void {
    this.logger.log('WebSocket gateway initialized on path /ws');
  }

  handleConnection(_client: WebSocket): void {
    this.connectionCount++;
    this.logger.log(`WS client connected. Active: ${this.connectionCount}`);
  }

  handleDisconnect(_client: WebSocket): void {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.logger.log(`WS client disconnected. Active: ${this.connectionCount}`);
  }

  /** Returns the current number of live connections (used by InternalService health). */
  getConnectionCount(): number {
    return this.connectionCount;
  }

  publishUserCreated(user: EventPayload): void {
    this.broadcast('user.created', user);
  }

  publishUserUpdated(user: EventPayload): void {
    this.broadcast('user.updated', user);
  }

  /**
   * Called by MarketDataService after a fresh Binance fetch.
   * `room` is the symbol key (e.g. "ticker:BTCUSDT") — used as the event name
   * so clients can filter by symbol without needing room support.
   */
  publishTicker(event: string, ticker: EventPayload): void {
    this.broadcast(event, ticker);
  }

  private broadcast(event: string, data: EventPayload): void {
    if (!this.server?.clients?.size) {
      return;
    }

    const message = JSON.stringify({ event, data });
    let sent = 0;

    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    if (sent > 0) {
      this.logger.debug(`Broadcast '${event}' → ${sent} client(s)`);
    }
  }
}
