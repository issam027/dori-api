import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SwaggerModule } from '@nestjs/swagger';
import { AppointmentExpiryWorker } from '../workers/appointment-expiry/appointment-expiry.worker';
import { DailyResetWorker } from '../workers/daily-reset/daily-reset.worker';
import { NotificationWorker } from '../workers/notification-worker/notification.worker';
import { QueueEstimationWorker } from '../workers/queue-estimation/queue-estimation.worker';
import { createOpenApiConfig } from '../core/swagger/openapi.config';
import { CronController } from './cron.controller';

describe('CronController OpenAPI', () => {
  it('publishes all cron operations under ScheduledTasks', async () => {
    const module = await Test.createTestingModule({
      controllers: [CronController],
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: DailyResetWorker, useValue: {} },
        { provide: AppointmentExpiryWorker, useValue: {} },
        { provide: NotificationWorker, useValue: {} },
        { provide: QueueEstimationWorker, useValue: {} },
      ],
    }).compile();
    const app = module.createNestApplication();
    const document = SwaggerModule.createDocument(app, createOpenApiConfig());

    for (const path of [
      'daily-reset',
      'appointment-expiry',
      'notifications',
      'queue-estimation',
    ]) {
      const operation = document.paths[`/api/internal/cron/${path}`]?.get;
      expect(operation).toBeDefined();
      expect(operation?.tags).toEqual(['ScheduledTasks']);
      expect(operation?.summary).toBeTruthy();
      expect(operation?.security).toContainEqual({ 'cron-secret': [] });
    }

    await app.close();
  });
});
