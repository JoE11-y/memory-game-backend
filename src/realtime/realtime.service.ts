import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ApiService } from 'libs/api.service';
import { RandomService } from 'libs/random.service';
import { Server } from 'socket.io';

@Injectable()
export class RealtimeService {
  private server: Server;
  constructor(
    private readonly prisma: PrismaService,
    private readonly randomService: RandomService,
    private readonly api: ApiService,
  ) {}

  private cards: Map<string, CardState[]> = new Map<string, CardState[]>();

  private async initCards(): Promise<Card[]> {
    const cards = await this.api.getCards<Card[]>('animals');
    return cards;
  }

  private shuffleCards(cards: Card[]): CardState[] {
    const doubled = [...cards, ...cards];
    for (let i = doubled.length - 1; i > 0; i--) {
      const j = Math.floor(this.randomService.randomize().random * (i + 1));
      [doubled[i], doubled[j]] = [doubled[j], doubled[i]];
    }

    const finalCards = doubled.map(
      (data, index) =>
        ({
          id: `${data.id}${index}`,
          isMatched: false,
          isOpen: false,
          userId: null,
          url: data.src.original,
        }) as CardState,
    );

    return finalCards;
  }

  setServer(server: Server) {
    this.server = server;
  }

  getServer(): Server {
    return this.server;
  }

  async startGame(userId: string, maxPlayers: number) {
    const cards = await this.initCards();

    const shuffleCards = this.shuffleCards(cards);

    const game = await this.prisma.game.create({
      data: {
        status: 'awaiting-players',
        maxPlayers: maxPlayers,
      },
      include: { players: true, message: true, rounds: true },
    });

    this.cards.set(game.id, shuffleCards);

    await this.joinGame(game.id, userId);

    return game.id;
  }

  async joinGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true, rounds: true },
    });

    if (!game) throw new Error('Game not found');

    if (game.players.length >= game.maxPlayers)
      throw new Error('Game already full');

    const card = this.cards.get(game.id);

    if (!card) throw new Error('Card not found for game');

    if (game.players.length + 1 >= game.maxPlayers) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          status: 'game-started',
          players: {
            create: {
              userId,
              score: 0,
            },
          },
          rounds: {
            create: {},
          },
        },
      });
    } else {
      await this.prisma.game.update({
        where: { id: gameId },
        data: {
          players: {
            create: {
              userId,
              score: 0,
            },
          },
        },
      });
    }

    return true;
  }

  async getGameState(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    const cards = this.cards.get(game.id);

    if (!cards) throw new Error('Card not found for game');

    return { ...game, cards: cards };
  }

  async leaveGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw new Error('Player not found in game');

    await this.prisma.player.delete({
      where: { id: player.id },
    });

    if (game.players.length == 0) {
      await this.prisma.game.delete({ where: { id: gameId } });
    }
  }

  async handlePlayerDisconnection(userId: string) {
    const games = await this.prisma.game.findMany({
      where: {
        players: {
          some: { userId },
        },
      },
      include: { players: true },
    });

    for (const game of games) {
      const player = game.players.find((p) => p.userId === userId);

      if (player) {
        await this.leaveGame(game.id, userId);
      }
    }
  }

  async getPlayerGames(userId: string) {
    return this.prisma.game.findMany({
      where: {
        players: {
          some: { userId },
        },
      },
      include: { players: true },
    });
  }

  async flipCard(gameId: string, userId: string, cardId: number) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true, rounds: true },
    });

    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw new Error('Player not found in game');

    if (game.status !== 'game-started' || game.isDisabled) {
      return;
    }

    const cards = this.cards.get(game.id);

    if (!cards) {
      throw new Error('Cards not set');
    }

    const currCard = cards[cardId];

    if (!currCard) {
      throw new Error('Invalid Card index');
    }

    if (currCard.isOpen) {
      throw new Error('Card already opened');
    }

    const roundData = await this.prisma.round.findFirst({
      where: {
        gameId: gameId,
        ended: false,
      },
      include: { flips: true },
    });

    if (!roundData) {
      throw new Error('No active rounds found');
    }

    const flip = await this.prisma.flip.findUnique({
      where: {
        playerId_roundId: {
          playerId: player.id,
          roundId: roundData.id,
        },
      },
    });

    if (!flip) {
      await this.prisma.flip.create({
        data: {
          player: { connect: { id: player.id } },
          round: { connect: { id: roundData.id } },
          cardsId: [cardId],
        },
      });
    } else if (flip.cardsId.length < 2) {
      await this.prisma.flip.update({
        where: {
          playerId_roundId: {
            playerId: player.id,
            roundId: roundData.id,
          },
        },
        data: {
          cardsId: [...flip.cardsId, cardId],
        },
      });
    } else {
      throw new Error('Already revealed max cards');
    }

    currCard.isOpen = true;
    currCard.userId = userId;
    cards[cardId] = currCard;
    this.cards.set(gameId, cards);

    if (flip.cardsId.length + 1 >= 2) {
      const prevId = flip.cardsId[0];
      const prevCard = cards[prevId];
      if (currCard.url == prevCard.url) {
        currCard.isMatched = true;
        prevCard.isMatched = true;

        await this.prisma.player.update({
          where: { id: player.id },
          data: {
            score: { increment: 2 },
          },
        });

        this.server.to(gameId).emit('game-state', {
          state: await this.getGameState(gameId),
          message: 'card match found',
        });
      }

      cards[prevId] = prevCard;
      cards[cardId] = currCard;
      this.cards.set(gameId, cards);
    }

    await this.checkRoundStatus(gameId, roundData.id);
  }

  private async checkRoundStatus(gameId: string, roundId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true, rounds: true },
    });

    const roundData = await this.prisma.round.findUnique({
      where: {
        id: roundId,
      },
      include: { flips: true },
    });

    if (!roundData) {
      throw new Error('Invalid round id');
    }

    const allPlayed = roundData.flips.length == game.players.length * 2;

    if (allPlayed) {
      await this.nextRound(gameId);
    }
  }

  async nextRound(gameId: string) {
    const roundData = await this.prisma.round.findFirst({
      where: {
        gameId: gameId,
        ended: false,
      },
      include: { flips: true },
    });

    const cards = this.cards.get(gameId);

    if (!roundData) {
      throw new Error('No active round');
    } else {
      await this.prisma.round.update({
        where: {
          id: roundData.id,
        },
        data: {
          ended: true,
        },
      });
    }

    let everyCardMatched = true;

    for (const card of cards) {
      if (!card.isMatched) {
        everyCardMatched = false;
        break;
      }
    }

    if (!everyCardMatched) {
      await this.prisma.game.update({
        where: { id: gameId },
        data: { status: 'game-ended' },
      });

      this.server.to(gameId).emit('game-state', {
        state: await this.getGameState(gameId),
        message: 'game ended',
      });
    } else {
      await this.prisma.round.create({
        data: { gameId: gameId },
      });

      this.server.to(gameId).emit('game-state', {
        state: await this.getGameState(gameId),
        message: 'new round',
      });
    }
  }

  async updateStat(userId: string, win: boolean, point: number) {
    const updatedData = win
      ? {
          total_wins: { increment: 1 },
          total_points: { increment: point },
          xp: { increment: Math.sqrt(point) },
        }
      : { total_losses: { increment: 1 } };

    return await this.prisma.stat.update({
      where: { userId },
      data: {
        ...updatedData,
      },
    });
  }

  async sendMessage(gameId: string, userId: string, message: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true, rounds: true },
    });
    const player = game.players.find((p) => p.userId === userId);
    if (!player) throw new Error('Player not found in game');

    await this.prisma.message.create({
      data: {
        player: { connect: { id: player.id } },
        game: { connect: { id: gameId } },
        text: message,
      },
    });

    this.server.to(gameId).emit('in-game-message', {
      message: message,
    });
  }

  async getGameMessages(gameId: string) {
    const messages = await this.prisma.message.findMany({
      where: { gameId: gameId },
      include: { player: true },
    });

    return messages;
  }
}
