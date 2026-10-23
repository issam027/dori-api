import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditEventQueryDto } from './audit-query.dto';

describe('AuditEventQueryDto', () => {
  it('accepts combined IHM filters', async () => {
    const dto = plainToInstance(AuditEventQueryDto, {
      page: '1',
      pageSize: '25',
      actorUserId: '7',
      outcome: 'success',
      search: 'site',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid outcome and an excessive date range', async () => {
    const dto = plainToInstance(AuditEventQueryDto, {
      outcome: 'unknown',
      dateFrom: '2025-01-01',
      dateTo: '2026-12-31',
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['outcome', '_dateRange']),
    );
  });
});
