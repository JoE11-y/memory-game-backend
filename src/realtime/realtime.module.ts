import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RandomService } from 'libs/random.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { PrismaService } from 'prisma/prisma.service';
import { ResponseService } from 'libs/response.service';
import { UtilService } from 'libs/utils.service';

@Module({
  providers: [
    RealtimeGateway,
    RealtimeService,
    {
      provide: RandomService,
      useFactory: () => new RandomService('sha256'),
    },
    JwtService,
    UtilService,
    PrismaService,
    ResponseService,
  ],
})
export class RealtimeModule {}
