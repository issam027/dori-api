import { DoriUser } from '../../modules/users/entities/user.entity';
import { DoriSite } from '../../modules/sites/entities/site.entity';
import { DoriQueue } from '../../modules/queues/entities/queue.entity';
import { DoriPerson } from '../../modules/persons/entities/person.entity';
import { DoriPersonNote } from '../../modules/persons/entities/person-note.entity';
import { DoriServiceTier } from '../../modules/service-tiers/entities/service-tier.entity';
import { DoriQueueServiceTier } from '../../modules/service-tiers/entities/queue-service-tier.entity';
import { DoriTierNotificationRule } from '../../modules/service-tiers/entities/tier-notification-rule.entity';
import { DoriQueueSession } from '../../modules/queue-engine/entities/queue-session.entity';
import { DoriQueueCounter } from '../../modules/queue-engine/entities/queue-counter.entity';
import { DoriRegistration } from '../../modules/registrations/entities/registration.entity';
import { DoriNotification } from '../../modules/notifications/entities/notification.entity';
import { DoriTranslation } from '../../modules/translations/entities/translation.entity';
import { DoriTranslationVersion } from '../../modules/translations/entities/translation-version.entity';
import { DoriRole } from '../../modules/rbac/entities/role.entity';
import { DoriPermission } from '../../modules/rbac/entities/permission.entity';
import { DoriRolePermission } from '../../modules/rbac/entities/role-permission.entity';
import { DoriUserRole } from '../../modules/rbac/entities/user-role.entity';
import { DoriUserSite } from '../../modules/rbac/entities/user-site.entity';
import { DoriUserQueue } from '../../modules/rbac/entities/user-queue.entity';
import { DoriUserSession } from '../../modules/auth/entities/user-session.entity';

export const ALL_ENTITIES = [
  DoriUser,
  DoriSite,
  DoriQueue,
  DoriPerson,
  DoriPersonNote,
  DoriServiceTier,
  DoriQueueServiceTier,
  DoriTierNotificationRule,
  DoriQueueSession,
  DoriQueueCounter,
  DoriRegistration,
  DoriNotification,
  DoriTranslation,
  DoriTranslationVersion,
  DoriRole,
  DoriPermission,
  DoriRolePermission,
  DoriUserRole,
  DoriUserSite,
  DoriUserQueue,
  DoriUserSession,
];

export {
  DoriUser,
  DoriSite,
  DoriQueue,
  DoriPerson,
  DoriPersonNote,
  DoriServiceTier,
  DoriQueueServiceTier,
  DoriTierNotificationRule,
  DoriQueueSession,
  DoriQueueCounter,
  DoriRegistration,
  DoriNotification,
  DoriTranslation,
  DoriTranslationVersion,
  DoriRole,
  DoriPermission,
  DoriRolePermission,
  DoriUserRole,
  DoriUserSite,
  DoriUserQueue,
  DoriUserSession,
};
