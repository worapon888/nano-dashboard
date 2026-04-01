import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'http';
import { UserRole } from '@prisma/client';
import { Server, WebSocket } from 'ws';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
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
  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectionCount = 0;
  private readonly connectedClients = new Set<WebSocket>();
  private readonly authenticatedClients = new Map<WebSocket, CurrentUserPayload>();
  private readonly clientsByRoom = new Map<string, Set<WebSocket>>();

  afterInit(_server: Server): void {
    this.logger.log('WebSocket gateway initialized on path /ws');
  }

  async handleConnection(
    client: WebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    try {
      const currentUser = await this.authenticateClient(request);

      this.connectedClients.add(client);
      if (currentUser) {
        this.authenticatedClients.set(client, currentUser);
        this.addClientToRoom(this.getUserRoom(currentUser.sub), client);
      }

      this.connectionCount++;
      this.logger.log(
        `WS client connected (${currentUser ? `authenticated:${currentUser.sub}` : 'public'}). Active: ${this.connectionCount}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unauthorized websocket client';

      this.logger.warn(`WS client rejected: ${reason}`);
      this.closeUnauthorizedClient(client, reason);
    }
  }

  handleDisconnect(client: WebSocket): void {
    const wasConnected = this.connectedClients.delete(client);
    const currentUser = this.authenticatedClients.get(client);
    this.authenticatedClients.delete(client);

    if (currentUser) {
      this.removeClientFromRoom(this.getUserRoom(currentUser.sub), client);
    }

    if (!wasConnected) {
      return;
    }

    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.logger.log(`WS client disconnected. Active: ${this.connectionCount}`);
  }

  /** Returns the current number of live connections (used by InternalService health). */
  getConnectionCount(): number {
    return this.connectionCount;
  }

  publishUserCreated(user: EventPayload): void {
    this.broadcastToAdmins('user.created', user);
  }

  publishUserUpdated(user: EventPayload): void {
    const userId = typeof user.id === 'string' ? user.id : null;

    this.broadcastToAdmins('user.updated', user);

    if (userId) {
      this.broadcastToRoom(this.getUserRoom(userId), 'user.updated', user);
    }
  }

  /**
   * Called by MarketDataService after a fresh Binance fetch.
   * `room` is the symbol key (e.g. "ticker:BTCUSDT") — used as the event name
   * so clients can filter by symbol without needing room support.
   */
  publishTicker(event: string, ticker: EventPayload): void {
    this.broadcast(event, ticker, 'all');
  }

  private broadcast(
    event: string,
    data: EventPayload,
    audience: 'all' | 'authenticated',
  ): void {
    const targets =
      audience === 'authenticated'
        ? Array.from(this.authenticatedClients.keys())
        : Array.from(this.connectedClients);

    if (targets.length === 0) {
      return;
    }

    const message = JSON.stringify({ event, data });
    let sent = 0;

    targets.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    if (sent > 0) {
      this.logger.debug(`Broadcast '${event}' → ${sent} client(s)`);
    }
  }

  private broadcastToAdmins(event: string, data: EventPayload): void {
    this.broadcastToClients(
      Array.from(this.authenticatedClients.entries())
        .filter(([, currentUser]) => currentUser.role === UserRole.ADMIN)
        .map(([client]) => client),
      event,
      data,
    );
  }

  private broadcastToRoom(room: string, event: string, data: EventPayload): void {
    const targets = Array.from(this.clientsByRoom.get(room) ?? []);
    this.broadcastToClients(targets, event, data);
  }

  private broadcastToClients(
    clients: WebSocket[],
    event: string,
    data: EventPayload,
  ): void {
    if (clients.length === 0) {
      return;
    }

    const message = JSON.stringify({ event, data });
    const deliveredClients = new Set<WebSocket>();
    let sent = 0;

    clients.forEach((client) => {
      if (deliveredClients.has(client)) {
        return;
      }

      deliveredClients.add(client);

      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        sent++;
      }
    });

    if (sent > 0) {
      this.logger.debug(`Broadcast '${event}' → ${sent} scoped client(s)`);
    }
  }

  private async authenticateClient(
    request: IncomingMessage,
  ): Promise<CurrentUserPayload | null> {
    const token = this.extractToken(request);

    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<CurrentUserPayload>(token);

      if (!payload?.sub || !payload.email || !payload.role) {
        throw new UnauthorizedException('Invalid websocket credentials');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid websocket credentials');
    }
  }

  private extractToken(request: IncomingMessage): string | null {
    const authorization = request.headers.authorization;

    if (authorization?.startsWith('Bearer ')) {
      return authorization.replace('Bearer ', '').trim();
    }

    const requestUrl = request.url ?? '/ws';
    const parsedUrl = new URL(requestUrl, 'ws://localhost');
    const queryToken =
      parsedUrl.searchParams.get('token') ??
      parsedUrl.searchParams.get('accessToken');

    return queryToken && queryToken.trim().length > 0 ? queryToken.trim() : null;
  }

  private closeUnauthorizedClient(client: WebSocket, reason: string): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          event: 'ws.error',
          data: {
            code: 'UNAUTHORIZED',
            message: reason,
          },
        }),
      );
    }

    client.close(4401, reason);
  }

  private addClientToRoom(room: string, client: WebSocket): void {
    const clients = this.clientsByRoom.get(room) ?? new Set<WebSocket>();
    clients.add(client);
    this.clientsByRoom.set(room, clients);
  }

  private removeClientFromRoom(room: string, client: WebSocket): void {
    const clients = this.clientsByRoom.get(room);

    if (!clients) {
      return;
    }

    clients.delete(client);

    if (clients.size === 0) {
      this.clientsByRoom.delete(room);
    }
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
