import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PiiStrippingInterceptor } from './common/pii-stripping.interceptor';
import { PiiInjectionService } from './common/pii-injection.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 300000, limit: 100 }]),
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PiiStrippingInterceptor,
    },
    PiiInjectionService,
  ],
  exports: [PiiInjectionService],
})
export class AppModule {}
