export const USER_EVENTS_PUBLISHER = 'USER_EVENTS_PUBLISHER';
export const MARKET_EVENTS_PUBLISHER = 'MARKET_EVENTS_PUBLISHER';
export const WS_CONNECTIONS_PROVIDER = 'WS_CONNECTIONS_PROVIDER';

export type EventPayload = Record<string, unknown>;

export interface UserEventsPublisher {
  publishUserCreated(user: EventPayload): void | Promise<void>;
  publishUserUpdated(user: EventPayload): void | Promise<void>;
}

export interface MarketEventsPublisher {
  publishTicker(event: string, ticker: EventPayload): void | Promise<void>;
}

export interface WsConnectionsProvider {
  getConnectionCount(): number | Promise<number>;
}
