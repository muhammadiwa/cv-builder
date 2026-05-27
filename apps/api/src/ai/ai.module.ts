import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { PiiGatewayService } from '../common/pii-gateway.service';

@Module({
    controllers: [AiController],
    providers: [AiService, PiiGatewayService],
    exports: [AiService],
})
export class AiModule { }
