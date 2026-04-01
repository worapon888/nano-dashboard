import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsGateway } from './events.gateway';
import {
  MARKET_EVENTS_PUBLISHER,
  USER_EVENTS_PUBLISHER,
  WS_CONNECTIONS_PROVIDER,
} from './events.tokens';

/**
 * @Global() so that once AppModule imports this, all three injection tokens
 * (USER_EVENTS_PUBLISHER, MARKET_EVENTS_PUBLISHER, WS_CONNECTIONS_PROVIDER) are
 * available to every module without them needing to re-import EventsModule.
 *
 * Services that consume these tokens use @Optional() so the app and its
 * isolated test modules continue to work when the gateway is absent.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [
    EventsGateway,
    {
      provide: USER_EVENTS_PUBLISHER,
      useExisting: EventsGateway,
    },
    {
      provide: MARKET_EVENTS_PUBLISHER,
      useExisting: EventsGateway,
    },
    {
      provide: WS_CONNECTIONS_PROVIDER,
      useExisting: EventsGateway,
    },
  ],
  exports: [
    EventsGateway,
    USER_EVENTS_PUBLISHER,
    MARKET_EVENTS_PUBLISHER,
    WS_CONNECTIONS_PROVIDER,
  ],
})
export class EventsModule {}
