import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CustomAuthMiddleware } from 'src/middleware/custom-auth.middleware';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ApiService } from 'libs/api.service';
import { PrismaService } from 'prisma/prisma.service';
import { ResponseService } from 'libs/response.service';
import { UtilService } from 'libs/utils.service';
import { AuthModule } from 'src/auth/auth.module';
import { HttpModule } from '@nestjs/axios';
import { RealtimeService } from 'src/realtime/realtime.service';
import { RealtimeModule } from 'src/realtime/realtime.module';

@Module({
  imports: [AuthModule, JwtModule, HttpModule, RealtimeModule],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    ApiService,
    PrismaService,
    ResponseService,
    UtilService,
    RealtimeService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CustomAuthMiddleware).forRoutes('*');
  }
}
