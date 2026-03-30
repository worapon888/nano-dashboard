import { ConfigService } from '@nestjs/config';
import { CurrentUserPayload } from '../interfaces/current-user-payload.interface';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: CurrentUserPayload): CurrentUserPayload;
}
export {};
