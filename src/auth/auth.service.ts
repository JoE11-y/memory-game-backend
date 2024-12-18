import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResponseService } from 'libs/response.service';
import { PrismaService } from 'prisma/prisma.service';
import { AuthDTO, UsernameDTO } from './dto/auth.dto';
import { StatusCodes } from 'enums/StatusCodes';
import { Response } from 'express';
import { UtilService } from 'libs/utils.service';

@Injectable()
export class AuthService {
  private response: ResponseService;

  constructor(
    readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly utils: UtilService,
  ) {
    this.response = new ResponseService();
  }

  async signup(res: Response, { username, password }: AuthDTO) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        return this.response.sendError(
          res,
          StatusCodes.Conflict,
          'Warning! Existing user',
        );
      }

      password = await this.utils.hashAsync(password, 12);

      const newuser = await this.prisma.user.create({
        data: { username, password },
      });

      const access_token = await this.utils.generateAccessToken({
        sub: newuser.id,
        username: username,
      });

      this.response.sendSuccess(res, StatusCodes.Created, {
        message: 'Successful',
        access_token,
      });
    } catch (err) {
      this.utils.handleServerError(res, err);
    }
  }

  async login(res: Response, { username, password }: AuthDTO) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return this.response.sendError(
          res,
          StatusCodes.NotFound,
          'Invalid username or password',
        );
      }

      const isMatch = await this.utils.compareAsync(password, user.password);
      if (!isMatch) {
        return this.response.sendError(
          res,
          StatusCodes.Unauthorized,
          'Incorrect password',
        );
      }

      const access_token = await this.utils.generateAccessToken({
        sub: user.id,
        username: username,
      });

      this.response.sendSuccess(res, StatusCodes.OK, {
        data: { username },
        access_token,
      });
    } catch (err) {
      this.utils.handleServerError(res, err);
    }
  }

  async editUsername(
    res: Response,
    { sub }: ExpressUser,
    { username }: UsernameDTO,
  ) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          username: { equals: username, mode: 'insensitive' },
        },
      });

      if (user) {
        return this.response.sendError(
          res,
          StatusCodes.Conflict,
          'Username has been taken',
        );
      }

      await this.prisma.user.update({
        where: { id: sub },
        data: { username },
      });

      this.response.sendSuccess(res, StatusCodes.OK, {
        data: { username },
        message: 'Username has been updated successfully',
      });
    } catch (err) {
      this.utils.handleServerError(res, err);
    }
  }

  async profile(res: Response, { sub }: ExpressUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      include: {
        stat: true,
      },
    });

    this.response.sendSuccess(res, StatusCodes.OK, {
      data: {
        ...user,
      },
    });
  }
}
