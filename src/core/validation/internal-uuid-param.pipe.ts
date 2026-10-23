import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/** Enforces UUID semantics for internal route parameters ending in `Id`. */
@Injectable()
export class InternalUuidParamPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.type !== 'param' ||
      !metadata.data?.endsWith('Id') ||
      ['eventId', 'correlationId', 'providerMessageId', 'messageId'].includes(
        metadata.data,
      )
    )
      return value;
    const parsed = String(value);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed,
      )
    ) {
      throw new BadRequestException(`${metadata.data} must be a UUID`);
    }
    return parsed.toLowerCase();
  }
}
