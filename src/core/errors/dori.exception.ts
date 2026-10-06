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

    const tParams = { ...translationParams };
    let data = payload;

    // ERR-01 : Standardisation du format des erreurs de validation
    if (code === 'VALIDATION_ERROR') {
      if (!data) {
        if (tParams.errors) {
          const errorsList = Array.isArray(tParams.errors)
            ? (tParams.errors as string[])
            : [String(tParams.errors)];
          data = { errors: errorsList };
          delete tParams.errors;
        } else if (tParams.message) {
          data = { errors: [String(tParams.message)] };
          delete tParams.message;
        } else {
          data = { errors: [] };
        }
      } else if (Array.isArray(data)) {
        data = { errors: data };
      } else if (typeof data === 'string') {
        data = { errors: [data] };
      } else if (typeof data === 'object' && !('errors' in (data as object))) {
        if ('message' in (data as object)) {
          data = { errors: [String((data as any).message)] };
        }
      }
    }

    super(
      {
        code,
        translationKey: entry.translationKey,
        translationParams: tParams,
        data,
      },
      entry.status,
    );
    this.code = code;
    this.translationKey = entry.translationKey;
    this.translationParams = tParams;
    this.payload = data;
  }
}
