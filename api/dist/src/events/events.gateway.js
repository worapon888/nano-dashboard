"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EventsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsGateway = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let EventsGateway = EventsGateway_1 = class EventsGateway {
    jwtService;
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    server;
    logger = new common_1.Logger(EventsGateway_1.name);
    connectionCount = 0;
    connectedClients = new Map();
    authenticatedClients = new Map();
    afterInit() {
        this.logger.log('Socket.io gateway initialized on path /ws');
    }
    async handleConnection(client) {
        try {
            const currentUser = await this.authenticateClient(client);
            this.connectedClients.set(client.id, client);
            if (currentUser) {
                this.authenticatedClients.set(client.id, currentUser);
                client.join(this.getUserRoom(currentUser.sub));
            }
            this.connectionCount++;
            this.logger.log(`Socket client connected (${currentUser ? `authenticated:${currentUser.sub}` : 'public'}). Active: ${this.connectionCount}`);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : 'Unauthorized websocket client';
            this.logger.warn(`Socket client rejected: ${reason}`);
            client.emit('ws.error', {
                code: 'UNAUTHORIZED',
                message: reason,
            });
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const wasConnected = this.connectedClients.delete(client.id);
        this.authenticatedClients.delete(client.id);
        if (!wasConnected) {
            return;
        }
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        this.logger.log(`Socket client disconnected. Active: ${this.connectionCount}`);
    }
    getConnectionCount() {
        return this.connectionCount;
    }
    publishUserCreated(user) {
        this.server.emit('user.created', user);
    }
    publishUserUpdated(user) {
        this.server.emit('user.updated', user);
    }
    publishTicker(event, ticker) {
        this.server.emit(event, ticker);
    }
    async authenticateClient(client) {
        const token = this.extractToken(client);
        if (!token) {
            return null;
        }
        try {
            const payload = await this.jwtService.verifyAsync(token);
            if (!payload?.sub || !payload.email || !payload.role) {
                throw new common_1.UnauthorizedException('Invalid websocket credentials');
            }
            return {
                sub: payload.sub,
                email: payload.email,
                role: payload.role,
            };
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid websocket credentials');
        }
    }
    extractToken(client) {
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
    getUserRoom(userId) {
        return `user:${userId}`;
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: '/ws',
        cors: {
            origin: true,
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map