import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class GameIdDTO {
  @IsString()
  @IsNotEmpty()
  gameId: string;
}

export class StartGameDTO {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  noOfPlayers: number;
}

export class FlipCardDTO {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsInt()
  @IsNotEmpty()
  cardId: number;
}

export class SendMessageDTO {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
