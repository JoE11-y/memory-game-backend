import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthDTO, UsernameDTO } from './dto/auth.dto';
import { Response } from 'express';
import { JwtAuthGuard } from 'src/jwt/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  async signup(@Res() res: Response, @Body() body: AuthDTO) {
    await this.authService.signup(res, body);
  }

  @Post('/login')
  async login(@Res() res: Response, @Body() body: AuthDTO) {
    await this.authService.login(res, body);
  }

  @ApiBearerAuth()
  @Patch('/username')
  @UseGuards(JwtAuthGuard)
  async editUsername(
    @Req() req: IRequest,
    @Res() res: Response,
    @Body() body: UsernameDTO,
  ) {
    await this.authService.editUsername(res, req.user, body);
  }

  @Get('/profile')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async profile(@Res() res: Response, @Req() req: IRequest) {
    await this.authService.profile(res, req.user);
  }
}
