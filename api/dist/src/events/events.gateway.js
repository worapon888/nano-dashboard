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
const ws_1 = require("ws");
let EventsGateway = EventsGateway_1 = class EventsGateway {
    server;
    logger = new common_1.Logger(EventsGateway_1.name);
    connectionCount = 0;
    afterInit(_server) {
        this.logger.log('WebSocket gateway initialized on path /ws');
    }
    handleConnection(_client) {
        this.connectionCount++;
        this.logger.log(`WS client connected. Active: ${this.connectionCount}`);
    }
    handleDisconnect(_client) {
        this.connectionCount = Math.max(0, this.connectionCount - 1);
        this.logger.log(`WS client disconnected. Active: ${this.connectionCount}`);
    }
    getConnectionCount() {
        return this.connectionCount;
    }
    publishUserCreated(user) {
        this.broadcast('user.created', user);
    }
    publishUserUpdated(user) {
        this.broadcast('user.updated', user);
    }
    publishTicker(event, ticker) {
        this.broadcast(event, ticker);
    }
    broadcast(event, data) {
        if (!this.server?.clients?.size) {
            return;
        }
        const message = JSON.stringify({ event, data });
        let sent = 0;
        this.server.clients.forEach((client) => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(message);
                sent++;
            }
        });
        if (sent > 0) {
            this.logger.debug(`Broadcast '${event}' → ${sent} client(s)`);
        }
    }
};
exports.EventsGateway = EventsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], EventsGateway.prototype, "server", void 0);
exports.EventsGateway = EventsGateway = EventsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/ws' })
], EventsGateway);
//# sourceMappingURL=events.gateway.js.map