// import { Socket } from 'socket.io';

interface JwtPayload {
  sub: string;
  username: string;
}

interface IRequest extends Request {
  user: ExpressUser;
}

interface ExpressUser extends Express.User {
  sub: string;
}

interface IRequest extends Request {
  user: ExpressUser;
}

type AlgoType = 'sha256' | 'md5';

type GameType = 'single' | 'multiplayer';

interface CardState {
  id: string;
  url: string;
  userId: string | null;
  isOpen: boolean;
  isMatched: boolean;
}

interface Card {
  id: string;
  src: {
    original: string;
  };
}

interface GameState {
  id: string;
  hasStarted: boolean;
  hasEnded: boolean;
  isDisabled: boolean;
  currRound: number;
  cards: CardState[];
  type: GameType;
  scores: Record<string, number>;
  flipsPerRound: Record<number, string>;
  maxPlayers: number;
  players: string[];
}

interface CardQueryResult {
  photos: Card[];
}
