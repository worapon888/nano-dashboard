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
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const ws_1 = require("ws");
let EventsGateway = EventsGateway_1 = class EventsGateway {
    jwtService;
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    server;
    logger = new common_1.Logger(EventsGateway_1.name);
    connectionCount = 0;
    connectedClients = new Set();
    authenticatedClients = new Map();
    clientsByRoom = new Map();
    afterInit(_server) {
        this.logger.log('WebSocket gateway initialized on path /ws');
    }
    async handleConnection(client, request) {
        try {
            const currentUser = await this.authenticateClient(request);
            this.connectedClients.add(client);
            if (currentUser) {
                this.authenticatedClients.set(client, currentUser);
                this.addClientToRoom(this.getUserRoom(currentUser.sub), client);
            }
            this.connectionCount++;
            this.logger.log(`WS client connected (${currentUser ? `authenticated:${currentUser.sub}` : 'public'}). Active: ${this.connectionCount}`);
        }
        catch (error) {
            const reason = error instanceof Error ? error.message : 'Unauthorized websocket client';
            this.logger.warn(`WS client rejected: ${reason}`);
            this.closeUnauthorizedClient(client, reason);
        }
    }
    handleDisconnect(client) {
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
    getConnectionCount() {
        return this.connectionCount;
    }
    publishUserCreated(user) {
        this.broadcastToAdmins('user.created', user);
    }
    publishUserUpdated(user) {
        const userId = typeof user.id === 'string' ? user.id : null;
        this.broadcastToAdmins('user.updated', user);
        if (userId) {
            this.broadcastToRoom(this.getUserRoom(userId), 'user.updated', user);
        }
    }
    publishTicker(event, ticker) {
        this.broadcast(event, ticker, 'all');
    }
    broadcast(event, data, audience) {
        const targets = audience === 'authenticated'
            ? Array.from(this.authenticatedClients.keys())
            : Array.from(this.connectedClients);
        if (targets.length === 0) {
            return;
        }
        const message = JSON.stringify({ event, data });
        let sent = 0;
        targets.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
                sent++;
            }
        });
        if (sent > 0) {
            this.logger.debug(`Broadcast '${event}' → ${sent} client(s)`);
        }
    }
    broadcastToAdmins(event, data) {
        this.broadcastToClients(Array.from(this.authenticatedClients.entries())
            .filter(([, currentUser]) => currentUser.role === client_1.UserRole.ADMIN)
            .map(([client]) => client), event, data);
    }
    broadcastToRoom(room, event, data) {
        const targets = Array.from(this.clientsByRoom.get(room) ?? []);
        this.broadcastToClients(targets, event, data);
    }
    broadcastToClients(clients, event, data) {
        if (clients.length === 0) {
            return;
        }
        const message = JSON.stringify({ event, data });
        const deliveredClients = new Set();
        let sent = 0;
        clients.forEach((client) => {
            if (deliveredClients.has(client)) {
                return;
            }
            deliveredClients.add(client);
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
                sent++;
            }
        });
        if (sent > 0) {
            this.logger.debug(`Broadcast '${event}' → ${sent} scoped client(s)`);
        }
    }
    async authenticateClient(request) {
        const token = this.extractToken(request);
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
    extractToken(request) {
        const authorization = request.headers.authorization;
        if (authorization?.startsWith('Bearer ')) {
            return authorization.replace('Bearer ', '').trim();
        }
        const requestUrl = request.url ?? '/ws';
        const parsedUrl = new URL(requestUrl, 'ws://localhost');
        const queryToken = parsedUrl.searchParams.get('token') ??
            parsedUrl.searchParams.get('accessToken');
        return queryToken && queryToken.trim().length > 0 ? queryToken.trim() : null;
    }
    closeUnauthorizedClient(client, reason) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(JSON.stringify({
                event: 'ws.error',
                data: {
                    code: 'UNAUTHORIZED',
                    message: reason,
                },
            }));
        }
        client.close(4401, reason);
    }
    addClientToRoom(room, client) {
        const clients = this.clientsByRoom.get(room) ?? new Set();
        clients.add(client);
        this.clientsByRoom.set(room, clients);
    }
    removeClientFromRoom(room, client) {
        const clients = this.clientsByRoom.get(room);
        if (!clients) {
            return;
        }
        clients.delete(client);
        if (clients.size === 0) {
            this.clientsByRoom.delete(room);
        }
    }
    getUserRoom(userId) {
        return `user:${userId}`;
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/ws' }),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map