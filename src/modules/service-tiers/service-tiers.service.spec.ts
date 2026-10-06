import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ServiceTiersService } from './service-tiers.service';
import { ScopeService } from '../../core/rbac/services/scope.service';
import { ClockService } from '../../core/clock/clock.service';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';
import { PaginationDto } from '../../core/pagination/pagination.dto';
import { ServiceTiersRepository } from './service-tiers.repository';

describe('ServiceTiersService — VAL-02 Pagination & Queue Tiers', () => {
  let service: ServiceTiersService;
  let dataSourceMock: { query: jest.Mock };
  let scopeServiceMock: {
    checkQueueAccess: jest.Mock;
    checkSiteAccess: jest.Mock;
  };

  const adminUser: AuthenticatedUser = {
    userId: 1,
    username: 'admin_user',
    roles: ['admin'],
    permissions: ['tier_view', 'queue_tier_manage'],
    userType: 'human',
  };

  beforeEach(async () => {
    dataSourceMock = {
      query: jest.fn(),
    };

    scopeServiceMock = {
      checkQueueAccess: jest.fn().mockResolvedValue(undefined),
      checkSiteAccess: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceTiersService,
        {
          provide: ServiceTiersRepository,
          useFactory: (dataSource: DataSource) =>
            new ServiceTiersRepository(dataSource),
          inject: [DataSource],
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
        {
          provide: ScopeService,
          useValue: scopeServiceMock,
        },
        {
          provide: ClockService,
          useValue: {
            now: jest.fn(() => new Date('2026-09-29T12:00:00Z')),
          },
        },
      ],
    }).compile();

    service = module.get<ServiceTiersService>(ServiceTiersService);
  });

  describe('findQueueTiers and getQueueTiers', () => {
    it('should return paginated queue tiers mapped to QueueTierResponseDto', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM dori_queue_service_tier')) {
          return [
            {
              queue_id: 10,
              tier_id: 2,
              price: '15.50',
              currency: 'TND',
              currency_override: null,
              currency_origin: 'site',
              is_active: true,
              is_default: false,
              is_system: false,
              display_order: 1,
              tier_code: 'VIP',
              tier_name: 'Forfait VIP',
              tier_description: 'Accès prioritaire',
            },
          ];
        }
        return [];
      });

      const pagination = new PaginationDto();
      pagination.page = 1;
      pagination.pageSize = 10;

      const result = await service.findQueueTiers(10, pagination, adminUser);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual({
        queueId: 10,
        tierId: 2,
        price: 15.5,
        currency: 'TND',
        currencyOverride: null,
        currencyOrigin: 'site',
        isActive: true,
        isDefault: false,
        displayOrder: 1,
        tier: {
          tierId: 2,
          tierCode: 'VIP',
          tierName: 'Forfait VIP',
          description: 'Accès prioritaire',
          isSystem: false,
          isActive: true,
        },
      });
    });

    it('getQueueTiers should delegate to findQueueTiers with pagination', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('COUNT(*)')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM dori_queue_service_tier')) {
          return [
            {
              queue_id: 10,
              tier_id: 1,
              price: '0',
              currency: 'TND',
              currency_override: null,
              currency_origin: 'site',
              is_active: true,
              is_default: true,
              is_system: true,
              display_order: 0,
              tier_code: 'FREE',
              tier_name: 'Gratuit',
              tier_description: 'Standard',
            },
          ];
        }
        return [];
      });

      const pagination = new PaginationDto();
      pagination.page = 2;
      pagination.pageSize = 5;

      const res = await service.getQueueTiers(10, pagination, adminUser);
      expect(res.page).toBe(2);
      expect(res.pageSize).toBe(5);
      expect(res.total).toBe(1);
      expect(res.items[0].tierId).toBe(1);
      expect(res.items[0].isDefault).toBe(true);
    });
  });

  describe('getNotificationRules', () => {
    it('should return all notification rules without artificial limit/truncation', async () => {
      dataSourceMock.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM dori_tier_notification_rule')) {
          return [
            {
              rule_id: 1,
              queue_id: 10,
              tier_id: 2,
              notification_type: 'threshold',
              threshold_position: 3,
              threshold_minutes: null,
              channel: 'sms',
              is_active: true,
              include_tracking_link: true,
            },
          ];
        }
        return [];
      });

      const rules = await service.getNotificationRules(10, 2, adminUser);
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual({
        ruleId: 1,
        queueId: 10,
        tierId: 2,
        notificationType: 'threshold',
        thresholdType: 'position',
        thresholdValue: 3,
        channel: 'sms',
        isActive: true,
        includeTrackingLink: true,
      });
    });

    it('allows a tracking link on both welcome and threshold rules', async () => {
      dataSourceMock.query
        .mockResolvedValueOnce([
          {
            rule_id: 1,
            queue_id: 10,
            tier_id: 2,
            notification_type: 'welcome',
            channel: 'sms',
            threshold_position: null,
            threshold_minutes: null,
            include_tracking_link: true,
            is_active: true,
          },
        ])
        .mockResolvedValueOnce([
          {
            rule_id: 2,
            queue_id: 10,
            tier_id: 2,
            notification_type: 'threshold',
            channel: 'email',
            threshold_position: null,
            threshold_minutes: 10,
            include_tracking_link: true,
            is_active: true,
          },
        ]);

      const welcome = await service.createNotificationRule(
        10,
        2,
        {
          notificationType: 'welcome',
          channel: 'sms',
          includeTrackingLink: true,
        },
        adminUser,
      );
      const threshold = await service.createNotificationRule(
        10,
        2,
        {
          notificationType: 'threshold',
          channel: 'email',
          thresholdType: 'estimatedTime',
          thresholdValue: 10,
          includeTrackingLink: true,
        },
        adminUser,
      );

      expect(welcome.thresholdType).toBeNull();
      expect(welcome.includeTrackingLink).toBe(true);
      expect(threshold.thresholdType).toBe('estimatedTime');
      expect(threshold.includeTrackingLink).toBe(true);
      expect(dataSourceMock.query.mock.calls[1][1][5]).toBe(10);
    });

    it('rejects a threshold rule without a complete threshold', async () => {
      await expect(
        service.createNotificationRule(
          10,
          2,
          { notificationType: 'threshold', channel: 'sms' },
          adminUser,
        ),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(dataSourceMock.query).not.toHaveBeenCalled();
    });
  });
});
