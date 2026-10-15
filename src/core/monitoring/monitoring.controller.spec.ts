import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsService } from '../../modules/reports/reports.service';
import { ReportSeriesQueryDto } from '../../modules/reports/dto/report-query.dto';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController series & DTO Validation (VAL-03)', () => {
  let controller: MonitoringController;
  let serviceMock: {
    getSeries: jest.Mock;
  };

  const testUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin',
    roles: ['admin'],
    permissions: ['report_view'],
    userType: 'human',
  };

  beforeEach(async () => {
    serviceMock = {
      getSeries: jest.fn().mockResolvedValue({ buckets: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [
        {
          provide: MonitoringService,
          useValue: {},
        },
        {
          provide: ReportsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<MonitoringController>(MonitoringController);
  });

  describe('ReportSeriesQueryDto validation', () => {
    it('validates a date range and exactly one scope', async () => {
      const dto = plainToInstance(ReportSeriesQueryDto, {
        queueIds: '1',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-29',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when the date range is missing', async () => {
      const dto = plainToInstance(ReportSeriesQueryDto, { queueIds: '1' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('fails when multiple scopes are supplied', async () => {
      const dto = plainToInstance(ReportSeriesQueryDto, {
        queueIds: '1',
        siteId: 2,
        dateFrom: '2026-09-01',
        dateTo: '2026-09-02',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('MonitoringController endpoint delegation', () => {
    it('series forwards the complete query and user', async () => {
      const query = plainToInstance(ReportSeriesQueryDto, {
        queueIds: '42',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-29',
      });
      const res = await controller.series(query, testUser);
      expect(serviceMock.getSeries).toHaveBeenCalledWith(query, testUser);
      expect(res).toEqual({ buckets: [] });
    });
  });
});
