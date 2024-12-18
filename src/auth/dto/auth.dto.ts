import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { USER_REGEX } from 'utils/regExp';

export class AuthDTO {
  @ApiProperty({
    example: 'test_user',
  })
  @IsString()
  @Matches(USER_REGEX, {
    message: 'Invalid username',
  })
  @IsNotEmpty()
  @Transform(({ value }) => value.toLowerCase().trim())
  username: string;

  @ApiProperty({
    example: 'test1256',
  })
  @MaxLength(32)
  @IsNotEmpty()
  password: string;
}

export class UsernameDTO {
  @ApiProperty({
    example: 'testuser',
  })
  @Matches(USER_REGEX, {
    message: 'Invalid username',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
