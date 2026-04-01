"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const events_gateway_1 = require("./events.gateway");
const events_tokens_1 = require("./events.tokens");
let EventsModule = class EventsModule {
};
exports.EventsModule = EventsModule;
exports.EventsModule = EventsModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        providers: [
            events_gateway_1.EventsGateway,
            {
                provide: events_tokens_1.USER_EVENTS_PUBLISHER,
                useExisting: events_gateway_1.EventsGateway,
            },
            {
                provide: events_tokens_1.MARKET_EVENTS_PUBLISHER,
                useExisting: events_gateway_1.EventsGateway,
            },
            {
                provide: events_tokens_1.WS_CONNECTIONS_PROVIDER,
                useExisting: events_gateway_1.EventsGateway,
            },
        ],
        exports: [
            events_gateway_1.EventsGateway,
            events_tokens_1.USER_EVENTS_PUBLISHER,
            events_tokens_1.MARKET_EVENTS_PUBLISHER,
            events_tokens_1.WS_CONNECTIONS_PROVIDER,
        ],
    })
], EventsModule);
//# sourceMappingURL=events.module.js.map