import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type NotificationChannel = 'sms' | 'email';
export type NotificationType = 'welcome' | 'threshold';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly configService: ConfigService) {}

  templateKey(
    channel: NotificationChannel,
    type: NotificationType,
    includeTrackingLink: boolean,
  ): string {
    return `${channel}.${type}${includeTrackingLink ? '_with_tracking' : ''}`;
  }

  buildTrackingUrl(token: string): string {
    const url = new URL(
      '/track',
      this.configService.getOrThrow<string>('tracking.publicWebUrl'),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  render(
    template: string,
    parameters: Record<string, string | number | null | undefined>,
  ): { content: string | null; failureReason: string | null } {
    const missing = new Set<string>();
    const content = template.replace(
      /\{([A-Za-z][A-Za-z0-9]*)\}/g,
      (_, key) => {
        const value = parameters[key];
        if (value === undefined || value === null) {
          missing.add(key);
          return `{${key}}`;
        }
        return String(value);
      },
    );
    return missing.size
      ? {
          content: null,
          failureReason: `TEMPLATE_PARAMETERS_MISSING:${[...missing].join(',')}`,
        }
      : { content, failureReason: null };
  }
}
