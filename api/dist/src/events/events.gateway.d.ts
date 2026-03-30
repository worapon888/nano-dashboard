import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { EventPayload, MarketEventsPublisher, UserEventsPublisher, WsConnectionsProvider } from './events.tokens';
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, UserEventsPublisher, MarketEventsPublisher, WsConnectionsProvider {
    private readonly server;
    private readonly logger;
    private connectionCount;
    afterInit(_server: Server): void;
    handleConnection(_client: WebSocket): void;
    handleDisconnect(_client: WebSocket): void;
    getConnectionCount(): number;
    publishUserCreated(user: EventPayload): void;
    publishUserUpdated(user: EventPayload): void;
    publishTicker(event: string, ticker: EventPayload): void;
    private broadcast;
}
