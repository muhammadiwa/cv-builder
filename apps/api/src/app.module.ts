import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PiiGatewayService } from './common/pii-gateway.service';
import { PiiInjectionService } from './common/pii-injection.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 300000, limit: 100 }]),
    AuthModule,
    UserModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    PiiGatewayService,
    PiiInjectionService,
  ],
  exports: [PiiGatewayService, PiiInjectionService],
})
export class AppModule {}
