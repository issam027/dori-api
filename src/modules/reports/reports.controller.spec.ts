import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import {
  DailyQueueReportQueryDto,
  DashboardSummaryQueryDto,
  DashboardQueueLoadQueryDto,
} from './dto/report-query.dto';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('ReportsController & DTO Validation (VAL-03)', () => {
  let controller: ReportsController;
  let serviceMock: {
    getDailyQueueReport: jest.Mock;
    getDashboardSummary: jest.Mock;
    getDashboardQueueLoad: jest.Mock;
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
      getDailyQueueReport: jest.fn().mockResolvedValue({ queueId: 1 }),
      getDashboardSummary: jest.fn().mockResolvedValue({ activeSites: 1 }),
      getDashboardQueueLoad: jest.fn().mockResolvedValue([]),
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

  describe('DailyQueueReportQueryDto validation', () => {
    it('should validate valid ISO date string YYYY-MM-DD', async () => {
      const dto = plainToInstance(DailyQueueReportQueryDto, {
        date: '2026-09-29',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail when date is missing or empty', async () => {
      const dto = plainToInstance(DailyQueueReportQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('date');
    });

    it('should fail when date is non-conforming (e.g. date="foo")', async () => {
      const dto = plainToInstance(DailyQueueReportQueryDto, { date: 'foo' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('date');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });
  });

  describe('DashboardSummaryQueryDto validation', () => {
    it('should pass with empty query (siteId is optional)', async () => {
      const dto = plainToInstance(DashboardSummaryQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should transform and validate valid numeric siteId string', async () => {
      const dto = plainToInstance(DashboardSummaryQueryDto, { siteId: '5' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.siteId).toBe(5);
    });

    it('should fail when siteId is not a valid integer', async () => {
      const dto = plainToInstance(DashboardSummaryQueryDto, {
        siteId: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('siteId');
    });

    it('should fail when siteId is less than 1', async () => {
      const dto = plainToInstance(DashboardSummaryQueryDto, { siteId: '0' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('siteId');
    });
  });

  describe('DashboardQueueLoadQueryDto validation', () => {
    it('should have default limit = 4 when not supplied', async () => {
      const dto = plainToInstance(DashboardQueueLoadQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(4);
    });

    it('should transform numeric string limit and siteId', async () => {
      const dto = plainToInstance(DashboardQueueLoadQueryDto, {
        limit: '10',
        siteId: '2',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.limit).toBe(10);
      expect(dto.siteId).toBe(2);
    });

    it('should fail when limit is invalid string or less than 1', async () => {
      const dto = plainToInstance(DashboardQueueLoadQueryDto, { limit: '-3' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('limit');
    });
  });

  describe('ReportsController endpoint delegation', () => {
    it('getDailyQueueReport should forward queueId, validated date and user to service', async () => {
      const query: DailyQueueReportQueryDto = { date: '2026-09-29' };
      const res = await controller.getDailyQueueReport(42, query, testUser);
      expect(serviceMock.getDailyQueueReport).toHaveBeenCalledWith(
        42,
        '2026-09-29',
        testUser,
      );
      expect(res).toEqual({ queueId: 1 });
    });

    it('getDashboardSummary should forward validated siteId and user to service', async () => {
      const query: DashboardSummaryQueryDto = { siteId: 7 };
      const res = await controller.getDashboardSummary(testUser, query);
      expect(serviceMock.getDashboardSummary).toHaveBeenCalledWith(7, testUser);
      expect(res).toEqual({ activeSites: 1 });
    });

    it('getDashboardQueueLoad should forward validated limit, siteId and user to service', async () => {
      const query: DashboardQueueLoadQueryDto = { limit: 10, siteId: 3 };
      const res = await controller.getDashboardQueueLoad(testUser, query);
      expect(serviceMock.getDashboardQueueLoad).toHaveBeenCalledWith(
        10,
        3,
        testUser,
      );
      expect(res).toEqual([]);
    });
  });
});
