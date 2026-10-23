import { DataSource } from 'typeorm';
import { PersonsRepository } from './persons.repository';

describe('PersonsRepository active note count', () => {
  it('includes a zero active-note count in person search results', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          person_id: '00000000-0000-4000-8000-000000000005',
          active_note_count: 0,
        },
      ]);
    const repository = new PersonsRepository({
      query,
    } as unknown as DataSource);

    const result = await repository.findPersons({
      siteId: '00000000-0000-4000-8000-000000000001',
      isActive: true,
      sortField: 'person_id',
      sortOrder: 'ASC',
      pageSize: 25,
      offset: 0,
    });

    expect(query.mock.calls[1][0]).toContain('COUNT(*)::int');
    expect(query.mock.calls[1][0]).toContain('pn.is_active = TRUE');
    expect(query.mock.calls[1][0]).toContain('pn.deleted_at IS NULL');
    expect(result.items[0].active_note_count).toBe(0);
  });

  it('includes the active-note count in person details', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        person_id: '00000000-0000-4000-8000-000000000005',
        site_id: '00000000-0000-4000-8000-000000000001',
        active_note_count: 2,
      },
    ]);
    const repository = new PersonsRepository({
      query,
    } as unknown as DataSource);

    const result = await repository.findById(
      '00000000-0000-4000-8000-000000000005',
    );

    expect(query.mock.calls[0][0]).toContain('COUNT(*)::int');
    expect(result?.active_note_count).toBe(2);
  });

  it('returns active and inactive persons when isActive is omitted', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { person_id: '00000000-0000-4000-8000-000000000005', is_active: true },
        { person_id: '00000000-0000-4000-8000-000000000006', is_active: false },
      ]);
    const repository = new PersonsRepository({
      query,
    } as unknown as DataSource);

    const result = await repository.findPersons({
      siteId: '00000000-0000-4000-8000-000000000014',
      search: '33233232311',
      sortField: 'last_name',
      sortOrder: 'ASC',
      pageSize: 10,
      offset: 0,
    });

    expect(result.total).toBe(2);
    expect(query.mock.calls[0][0]).not.toContain('p.is_active =');
    expect(query.mock.calls[0][1]).toEqual([
      '00000000-0000-4000-8000-000000000014',
      '%33233232311%',
    ]);
    expect(query.mock.calls[1][1]).toEqual([
      '00000000-0000-4000-8000-000000000014',
      '%33233232311%',
      10,
      0,
    ]);
  });

  it('still filters persons when isActive is explicit', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        { person_id: '00000000-0000-4000-8000-000000000006', is_active: false },
      ]);
    const repository = new PersonsRepository({
      query,
    } as unknown as DataSource);

    await repository.findPersons({
      siteId: '00000000-0000-4000-8000-000000000014',
      isActive: false,
      search: 'Test',
      sortField: 'last_name',
      sortOrder: 'ASC',
      pageSize: 10,
      offset: 0,
    });

    expect(query.mock.calls[0][0]).toContain('p.is_active = $2');
    expect(query.mock.calls[0][1]).toEqual([
      '00000000-0000-4000-8000-000000000014',
      false,
      '%Test%',
    ]);
  });
});
