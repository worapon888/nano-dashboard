import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketEventsPublisher } from '../events/events.tokens';
export declare class BtcVolumeLiveService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly marketEventsPublisher?;
    private readonly logger;
    private socket;
    private reconnectTimer;
    private reconnectAttempt;
    private isShuttingDown;
    private readonly lastEventSignatureByTimeframe;
    constructor(configService: ConfigService, marketEventsPublisher?: MarketEventsPublisher | undefined);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private shouldStartStream;
    private connect;
    private handleMessage;
    private parseMessage;
    private normalizeInterval;
    private scheduleReconnect;
    private getWsStreamUrl;
    private formatVolumeLabel;
    private toOptionalFiniteNumber;
}
