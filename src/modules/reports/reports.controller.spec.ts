import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportSeriesQueryDto } from './dto/report-query.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('ReportsController & DTO Validation (VAL-03)', () => {
  let controller: ReportsController;
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
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
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

  describe('ReportsController endpoint delegation', () => {
    it('getSeries forwards the complete query and user', async () => {
      const query = plainToInstance(ReportSeriesQueryDto, {
        queueIds: '42',
        dateFrom: '2026-09-01',
        dateTo: '2026-09-29',
      });
      const res = await controller.getSeries(query, testUser);
      expect(serviceMock.getSeries).toHaveBeenCalledWith(query, testUser);
      expect(res).toEqual({ buckets: [] });
    });
  });
});
