import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/** Enforces positive integer semantics for every route parameter ending in `Id`. */
@Injectable()
export class PositiveIdParamPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' || !metadata.data?.endsWith('Id'))
      return value;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(
        `${metadata.data} must be a positive integer`,
      );
    }
    return parsed;
  }
}
