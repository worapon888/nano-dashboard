import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { EventPayload, MarketEventsPublisher, UserEventsPublisher, WsConnectionsProvider } from './events.tokens';
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, UserEventsPublisher, MarketEventsPublisher, WsConnectionsProvider {
    private readonly jwtService;
    constructor(jwtService: JwtService);
    private readonly server;
    private readonly logger;
    private connectionCount;
    private readonly connectedClients;
    private readonly authenticatedClients;
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    getConnectionCount(): number;
    publishUserCreated(user: EventPayload): void;
    publishUserUpdated(user: EventPayload): void;
    publishTicker(event: string, ticker: EventPayload): void;
    private authenticateClient;
    private extractToken;
    private getUserRoom;
}
