import { HttpException } from '@nestjs/common';
import { ERROR_CATALOG } from './error-catalog';

export class DoriException extends HttpException {
  public readonly code: string;
  public readonly translationKey: string;
  public readonly translationParams: Record<string, unknown>;
  public readonly payload: unknown;

  constructor(
    code: string,
    translationParams: Record<string, unknown> = {},
    payload: unknown = null,
  ) {
    const entry = ERROR_CATALOG[code];
    if (!entry) {
      throw new Error(`Unknown error code: ${code}`);
    }
    super(
      {
        code,
        translationKey: entry.translationKey,
        translationParams,
        data: payload,
      },
      entry.status,
    );
    this.code = code;
    this.translationKey = entry.translationKey;
    this.translationParams = translationParams;
    this.payload = payload;
  }
}
