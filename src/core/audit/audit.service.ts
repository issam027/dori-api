import { Injectable } from '@nestjs/common';
import { DoriException } from '../errors/dori.exception';
import { AuditRepository } from './audit.repository';
import { AuditEventQueryDto } from './dto/audit-query.dto';
import { ScopeService } from '../rbac/services/scope.service';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

const ACTION_LABELS: Record<string, string> = {
  'site.create': 'Création d’un site',
  'site.update': 'Modification d’un site',
  'site.delete': 'Suppression d’un site',
  'site.user.assign': 'Affectation d’un utilisateur au site',
  'site.user.remove': 'Retrait d’un utilisateur du site',
  'queue.delete': 'Suppression d’une file',
  'queue.reset': 'Réinitialisation d’une file',
  'queue.operator.assign': 'Affectation d’un opérateur à la file',
  'queue.operator.remove': 'Retrait d’un opérateur de la file',
  'user.status.update': 'Modification du statut utilisateur',
  'user.delete': 'Suppression d’un utilisateur',
  'user.password.reset': 'Réinitialisation du mot de passe',
  'user.role.assign': 'Attribution d’un rôle',
  'user.role.remove': 'Retrait d’un rôle',
  'role.permissions.update': 'Modification des permissions du rôle',
  'person.note.create': 'Création d’une note',
  'person.note.update': 'Modification d’une note',
  'person.note.delete': 'Suppression d’une note',
  'person.delete': 'Suppression d’une personne',
};

@Injectable()
export class AuditService {
  constructor(
    private readonly repository: AuditRepository,
    private readonly scopeService: ScopeService,
  ) {}

  async search(query: AuditEventQueryDto, user: AuthenticatedUser) {
    const allowedSiteIds = await this.allowedSiteIds(user, query.siteId);
    const { pageSize, offset, sortOrder } = query.getParams(
      'occurred_at',
      'DESC',
    );
    const sortField = query.getSafeSortField(
      [
        'occurred_at',
        'action',
        'target_type',
        'outcome',
        'actor_user_id',
        'request_method',
      ],
      'occurred_at',
    );
    const result = await this.repository.search({
      filter: query,
      sortField,
      sortOrder,
      pageSize,
      offset,
      allowedSiteIds,
    });
    return query.createResponse(result.items, result.total);
  }

  async findById(eventId: string, user: AuthenticatedUser) {
    const allowedSiteIds = await this.allowedSiteIds(user);
    const event = await this.repository.findById(eventId, allowedSiteIds);
    if (!event) {
      throw new DoriException('RESOURCE_NOT_FOUND', {
        resource: 'auditEvent',
        eventId,
      });
    }
    return {
      ...event,
      action_display_name: ACTION_LABELS[event.action] ?? event.action,
    };
  }

  private async allowedSiteIds(
    user: AuthenticatedUser,
    requestedSiteId?: string,
  ): Promise<string[] | undefined> {
    const scope = await this.scopeService.getUserScope(user);
    if (requestedSiteId !== undefined && !scope.isGlobal) {
      await this.scopeService.checkSiteAccess(user, requestedSiteId);
    }
    return scope.isGlobal ? undefined : scope.siteIds;
  }
}
