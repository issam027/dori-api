import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SiteRequestsController } from './site-requests.controller';
import { AuthenticatedUser } from '../../core/auth/interfaces/jwt-payload.interface';

describe('Site requests root boundary', () => {
  const controller = new SiteRequestsController();
  const root = { roles: ['root'] } as AuthenticatedUser;
  const original = { ...process.env };
  beforeEach(() => {
    process.env.DORIFY_DEPLOYMENT_MODE = 'cloud';
    process.env.SITE_REQUESTS_URL = 'http://site:8080/internal/requests';
    process.env.SITE_REQUESTS_SECRET =
      'test-only-service-secret-not-production';
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...original };
  });
  it('rejects admin even with system_manage before accessing stored requests', async () => {
    const fetcher = jest.spyOn(global, 'fetch');
    await expect(
      controller.list({
        user: {
          roles: ['admin'],
          permissions: ['system_manage'],
        } as AuthenticatedUser,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects an intra root', async () => {
    process.env.DORIFY_DEPLOYMENT_MODE = 'intra';
    await expect(controller.list({ user: root })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('forwards root search and server-only credentials', async () => {
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
    await expect(
      controller.list({ user: root }, '2', 'mairie & accueil'),
    ).resolves.toEqual({ items: [], total: 0 });
    expect(fetcher).toHaveBeenCalledWith(
      'http://site:8080/internal/requests?page=2&search=mairie%20%26%20accueil',
      expect.objectContaining({
        redirect: 'error',
        headers: { 'X-Dorify-Service-Token': process.env.SITE_REQUESTS_SECRET },
      }),
    );
  });
  it('reports missing requests and unavailable storage without exposing secrets', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockRejectedValueOnce(new Error('private server detail'));
    await expect(
      controller.detail({ user: root }, 'a'.repeat(36)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(controller.list({ user: root })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
