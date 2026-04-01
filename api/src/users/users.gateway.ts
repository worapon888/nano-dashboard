import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

type UserCreatedEventPayload = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

type UserUpdatedEventPayload = {
  id: string;
  name: string;
  email: string;
  updatedAt: Date;
};

@WebSocketGateway({
  namespace: '/users',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class UsersGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(UsersGateway.name);
  private connectionCount = 0;

  @WebSocketServer()
  private readonly server: Server;

  afterInit(): void {
    this.logger.log('Users socket.io gateway initialized on namespace /users');
  }

  handleConnection(client: Socket): void {
    this.connectionCount++;
    this.logger.log(
      `Users client connected (${client.id}). Active: ${this.connectionCount}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.connectionCount = Math.max(0, this.connectionCount - 1);
    this.logger.log(
      `Users client disconnected (${client.id}). Active: ${this.connectionCount}`,
    );
  }

  emitUserCreated(payload: UserCreatedEventPayload): void {
    this.server.emit('user.created', payload);
    this.logger.debug(
      `Broadcast 'user.created' to ${this.connectionCount} connected client(s)`,
    );
  }

  emitUserUpdated(payload: UserUpdatedEventPayload): void {
    this.server.emit('user.updated', payload);
    this.logger.debug(
      `Broadcast 'user.updated' to ${this.connectionCount} connected client(s)`,
    );
  }
}
