import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResponseService } from 'libs/response.service';
import { env } from 'configs/env.config';
import { Response } from 'express';
import { StatusCodes } from 'enums/StatusCodes';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UtilService {
  private response: ResponseService;

  constructor(readonly jwtService: JwtService) {
    this.response = new ResponseService();
  }

  async generateAccessToken({ sub, username }: JwtPayload): Promise<string> {
    return await this.jwtService.signAsync(
      { sub, username },
      {
        expiresIn: env.jwt.expiry,
        secret: env.jwt.secret,
      },
    );
  }

  async hashAsync(password: string, saltRounds: number = 10): Promise<string> {
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(password, salt);
  }

  async compareAsync(plain: string | Buffer, hashed: string): Promise<boolean> {
    return await bcrypt.compare(plain, hashed);
  }

  handleServerError(res: Response, err?: any, msg?: string) {
    console.error(err);
    return this.response.sendError(
      res,
      StatusCodes.InternalServerError,
      msg || err?.message || 'Something went wrong',
    );
  }
}
