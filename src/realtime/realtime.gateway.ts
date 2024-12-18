import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './realtime.service';
import { PrismaService } from 'prisma/prisma.service';
import { StatusCodes } from 'enums/StatusCodes';
import { JwtService } from '@nestjs/jwt';
import { env } from 'configs/env.config';
import { FlipCardDTO, GameIdDTO, StartGameDTO } from './dto/index.dto';

@WebSocketGateway({
  transports: ['polling', 'websocket'],
  cors: {
    origin: ['http://localhost:3000'],
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayInit, OnGatewayInit
{
  @WebSocketServer() server: Server;

  private clients: Map<Socket, JwtPayload> = new Map();
  private onlineUsers: Map<string, string> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit() {
    this.realtimeService.setServer(this.server);
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.headers['authorization']?.split('Bearer ')[1];

    if (token) {
      try {
        const { sub, username } = (await this.jwtService.verifyAsync(token, {
          secret: env.jwt.expiry,
          ignoreExpiration: false,
        })) as JwtPayload;

        const userData = await this.prisma.user.findUnique({
          where: { id: sub },
        });

        if (!userData) {
          client.emit('error', {
            status: StatusCodes.NotFound,
            message: 'Account not found',
          });
          client.disconnect();
          return;
        }

        this.clients.set(client, { sub, username });
        this.onlineUsers.set(sub, client.id);
        this.emitOnlineUserCount();
      } catch (e) {
        client.emit('error', {
          status: StatusCodes.InternalServerError,
          message: e.message,
        });
        client.disconnect();
      }
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.clients.get(client);
    if (user) {
      this.realtimeService.handlePlayerDisconnection(user.sub);
      this.onlineUsers.delete(user.sub);
      this.emitOnlineUserCount();
    }
    this.clients.delete(client);
  }

  private emitOnlineUserCount() {
    const onlineUserCount = this.onlineUsers.size;
    this.server.emit('online-user-count', { data: onlineUserCount });
  }

  @SubscribeMessage('start-game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { noOfPlayers }: StartGameDTO,
  ) {
    const user = this.clients.get(client);

    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      });
      return;
    }

    try {
      const gameId = await this.realtimeService.startGame(
        user.sub,
        noOfPlayers,
      );
      client.emit('game-started', { gameId, player: user.sub });
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      });
    }
  }

  @SubscribeMessage('join-game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() { gameId }: GameIdDTO,
  ) {
    const user = this.clients.get(client);

    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      });
      return;
    }

    try {
      await this.realtimeService.joinGame(gameId, user.sub);
      client.emit('game-joined', {
        gameId,
        player: user.sub,
      });
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      });
    }
  }

  @SubscribeMessage('flip-card')
  async handleRevealCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() { gameId, cardId }: FlipCardDTO,
  ) {
    const user = this.clients.get(client);

    if (!user) {
      client.emit('error', {
        status: StatusCodes.Unauthorized,
        message: 'User not authenticated',
      });
      return;
    }

    try {
      await this.realtimeService.flipCard(gameId, user.sub, cardId);
      client.emit('card-flipped', {
        gameId,
        player: user.sub,
      });
    } catch (error) {
      client.emit('error', {
        status: StatusCodes.BadRequest,
        message: error.message,
      });
    }
  }
}
