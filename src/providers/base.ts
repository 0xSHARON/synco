import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ILRCProvider, ILyrics, ProviderOptions } from '../types.js';
import { Logger } from '../utils.js';

export abstract class LRCProvider implements ILRCProvider {
  public abstract readonly name: string;
  protected session: AxiosInstance;
  protected logger: Logger;
  protected options: ProviderOptions;

  constructor(options: ProviderOptions = {}) {
    this.options = options;
    this.logger = new Logger(this.constructor.name, Boolean(options.verbose));
    this.session = axios.create({
      timeout: options.timeoutMs ?? 10000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 syncedlyrics/1.0.0',
        Accept: 'application/json, text/plain, */*',
      },
    });
  }

  public toString(): string {
    return this.name;
  }

  public abstract getLrc(searchTerm: string): Promise<ILyrics | null>;

  public getLrcById?(trackId: string): Promise<ILyrics | null>;

  protected async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T | null> {
    try {
      const response = await this.session.get<T>(url, config);
      return response.data;
    } catch (err: any) {
      this.logger.debug(`GET request failed for ${url}:`, err?.message ?? err);
      return null;
    }
  }

  protected async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T | null> {
    try {
      const response = await this.session.post<T>(url, data, config);
      return response.data;
    } catch (err: any) {
      this.logger.debug(`POST request failed for ${url}:`, err?.message ?? err);
      return null;
    }
  }
}
