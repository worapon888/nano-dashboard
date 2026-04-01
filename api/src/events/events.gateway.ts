import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import type { CurrentUserPayload } from '../auth/interfaces/current-user-payload.interface';
import {
  EventPayload,
  MarketEventsPublisher,
  UserEventsPublisher,
  WsConnectionsProvider,
} from './events.tokens';

@WebSocketGateway({
  path: '/ws',
  cors: {
    origin: true,
    credentials: true,
  },
})
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
  private readonly connectedClients = new Map<string, Socket>();
  private readonly authenticatedClients = new Map<string, CurrentUserPayload>();

  afterInit(): void {
    this.logger.log('Socket.io gateway initialized on path /ws');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const currentUser = await this.authenticateClient(client);

      this.connectedClients.set(client.id, client);
      if (currentUser) {
        this.authenticatedClients.set(client.id, currentUser);
        client.join(this.getUserRoom(currentUser.sub));
      }

      this.connectionCount++;
      this.logger.log(
        `Socket client connected (${currentUser ? `authenticated:${currentUser.sub}` : 'public'}). Active: ${this.connectionCount}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Unauthorized websocket client';

      this.logger.warn(`Socket client rejected: ${reason}`);
      client.emit('ws.error', {
        code: 'UNAUTHORIZED',
        message: reason,
      });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const wasConnected = this.connectedClients.delete(client.id);
    this.authenticatedClients.delete(client.id);

    if (!wasConnected) {
      return;
    }

    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.logger.log(`Socket client disconnected. Active: ${this.connectionCount}`);
  }

  getConnectionCount(): number {
    return this.connectionCount;
  }

  publishUserCreated(user: EventPayload): void {
    this.server.emit('user.created', user);
  }

  publishUserUpdated(user: EventPayload): void {
    this.server.emit('user.updated', user);
  }

  publishTicker(event: string, ticker: EventPayload): void {
    this.server.emit(event, ticker);
  }

  private async authenticateClient(
    client: Socket,
  ): Promise<CurrentUserPayload | null> {
    const token = this.extractToken(client);

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
        role: payload.role as UserRole,
      };
    } catch {
      throw new UnauthorizedException('Invalid websocket credentials');
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.replace('Bearer ', '').trim();
    }

    const queryToken = client.handshake.query.token ?? client.handshake.query.accessToken;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    return null;
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
