import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditRepository } from './audit.repository';

describe('AuditInterceptor', () => {
  const append = jest.fn().mockResolvedValue(undefined);
  const repository = { append } as unknown as AuditRepository;
  const definition = {
    action: 'user.role.remove',
    targetType: 'user',
    targetParam: 'userId',
    secondaryTargetParam: 'roleId',
  };
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(definition),
  } as unknown as Reflector;
  const request = {
    user: { userId: 7 },
    params: { userId: '42', roleId: '3' },
    headers: { 'x-correlation-id': 'corr-1' },
    method: 'DELETE',
    path: '/api/v1/users/42/roles/3',
    route: { path: 'users/:userId/roles/:roleId' },
    body: {
      roleId: 3,
      password: 'never-audited',
      email: 'private@example.test',
    },
  };
  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  beforeEach(() => append.mockClear());

  it('records a successful sensitive action without body or PII', async () => {
    const interceptor = new AuditInterceptor(reflector, repository);
    const result = await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );

    expect(result).toEqual({ ok: true });
    expect(append).toHaveBeenCalledWith({
      actorUserId: 7,
      action: 'user.role.remove',
      targetType: 'user',
      targetId: '42',
      secondaryTargetId: '3',
      outcome: 'success',
      correlationId: 'corr-1',
      requestMethod: 'DELETE',
      requestPath: 'users/:userId/roles/:roleId',
      failureType: null,
      siteScopeId: null,
    });
    expect(JSON.stringify(append.mock.calls)).not.toContain('never-audited');
    expect(JSON.stringify(append.mock.calls)).not.toContain('private@example');
  });

  it('records only the error type and preserves the original failure', async () => {
    const interceptor = new AuditInterceptor(reflector, repository);
    const secretError = new TypeError('token=secret');
    const stream = interceptor.intercept(context, {
      handle: () => throwError(() => secretError),
    } as CallHandler);

    await expect(lastValueFrom(stream)).rejects.toBe(secretError);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', failureType: 'TypeError' }),
    );
    expect(JSON.stringify(append.mock.calls)).not.toContain('token=secret');
  });

  it('extracts an allowlisted target identifier from a create response', async () => {
    (
      reflector.getAllAndOverride as jest.MockedFunction<
        typeof reflector.getAllAndOverride
      >
    ).mockReturnValueOnce({
      action: 'site.create',
      targetType: 'site',
      targetResponseField: 'siteId',
    });
    const interceptor = new AuditInterceptor(reflector, repository);

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ data: { siteId: 81, siteName: 'Accueil' } }),
      }),
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: '81' }),
    );
    expect(JSON.stringify(append.mock.calls)).not.toContain('Accueil');
  });

  it('extracts only an explicitly allowlisted scalar identifier from the body', async () => {
    (
      reflector.getAllAndOverride as jest.MockedFunction<
        typeof reflector.getAllAndOverride
      >
    ).mockReturnValueOnce({
      action: 'user.role.assign',
      targetType: 'user',
      targetParam: 'userId',
      secondaryTargetBodyField: 'roleId',
    });
    const bodyRequest = {
      ...request,
      params: { userId: '42' },
      body: {
        roleId: 3,
        password: 'never-audited',
        email: 'private@example.test',
      },
    };
    const bodyContext = {
      ...context,
      switchToHttp: () => ({ getRequest: () => bodyRequest }),
    } as unknown as ExecutionContext;
    const interceptor = new AuditInterceptor(reflector, repository);

    await lastValueFrom(
      interceptor.intercept(bodyContext, { handle: () => of('ok') }),
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ secondaryTargetId: '3' }),
    );
    const serialized = JSON.stringify(append.mock.calls);
    expect(serialized).not.toContain('never-audited');
    expect(serialized).not.toContain('private@example');
  });

  it('extracts only explicitly allowed numeric body identifiers', async () => {
    const bodyDefinition = {
      action: 'user.role.assign',
      targetType: 'user',
      targetParam: 'userId',
      secondaryTargetBodyField: 'roleId',
    };
    (reflector.getAllAndOverride as jest.Mock).mockReturnValueOnce(
      bodyDefinition,
    );
    const interceptor = new AuditInterceptor(reflector, repository);

    await lastValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: '42',
        secondaryTargetId: '3',
      }),
    );
    expect(JSON.stringify(append.mock.calls)).not.toContain('never-audited');
  });

  it('does not fail the business request when audit storage is unavailable', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    append.mockRejectedValueOnce(new Error('database secret'));
    const interceptor = new AuditInterceptor(reflector, repository);

    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of('ok') })),
    ).resolves.toBe('ok');
    expect(logger.mock.calls.flat().join(' ')).not.toContain('database secret');
    logger.mockRestore();
  });
});
