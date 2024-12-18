import { Injectable } from '@nestjs/common';
import { lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { env } from 'configs/env.config';

@Injectable()
export class ApiService {
  constructor(private readonly httpService: HttpService) {}

  async GET<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const observable = this.httpService
      .get<T>(url, { headers })
      .pipe(map((response) => response.data));
    return lastValueFrom(observable);
  }

  async POST<T>(
    url: string,
    data: any,
    headers?: Record<string, string>,
  ): Promise<T> {
    const observable = this.httpService
      .post<T>(url, data, { headers })
      .pipe(map((response) => response.data));
    return lastValueFrom(observable);
  }

  getCards<T>(option: string) {
    return this.GET<T>(
      `https://api.pexels.com/v1/search?query=${option}&per_page=6`,
      {
        'Content-Type': 'application/json',
        'API-KEY': env.pexel.apiKey,
      },
    );
  }
}
