import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seed DORI...');

  // 1. Permissions (§4.9)
  const permissions = [
    { permissionName: 'site_view', description: 'Voir les sites accessibles' },
    { permissionName: 'site_create', description: 'Créer un site' },
    { permissionName: 'site_edit', description: "Modifier les détails d'un site" },
    { permissionName: 'site_delete', description: 'Désactiver un site' },
    { permissionName: 'queue_view', description: 'Voir les queues accessibles' },
    { permissionName: 'queue_create', description: 'Créer une queue' },
    { permissionName: 'queue_edit', description: 'Modifier une queue, déclencher sa clôture' },
    { permissionName: 'queue_delete', description: 'Désactiver une queue' },
    { permissionName: 'queue_tier_manage', description: 'Associer un forfait à une queue, fixer tarif et règles de notification' },
    { permissionName: 'tier_catalog_manage', description: 'Gérer le catalogue global de forfaits' },
    { permissionName: 'tier_view', description: 'Voir les forfaits proposés par une queue' },
    { permissionName: 'session_operate', description: 'Ouvrir, reprendre ou fermer un guichet' },
    { permissionName: 'customer_register', description: 'Inscrire un client (walk-in ou RDV)' },
    { permissionName: 'customer_view', description: "Consulter les inscriptions d'une queue" },
    { permissionName: 'customer_edit', description: 'Modifier une inscription' },
    { permissionName: 'customer_delete', description: 'Annuler (soft delete) une inscription' },
    { permissionName: 'customer_call', description: 'Appeler le suivant, marquer servi/absent' },
    { permissionName: 'appointment_manage', description: 'Réserver, reprogrammer, annuler, pointer un RDV' },
    { permissionName: 'person_note_view', description: 'Consulter les notes attachées à une personne' },
    { permissionName: 'person_note_manage', description: 'Créer, modifier, supprimer une note' },
    { permissionName: 'notification_send', description: 'Renvoyer une notification manuellement' },
    { permissionName: 'notification_view', description: "Consulter l'historique des notifications" },
    { permissionName: 'translation_manage', description: 'Gérer le catalogue de traduction (IHM + SMS)' },
    { permissionName: 'user_manage_kiosk', description: 'Créer/modifier/désactiver un compte borne' },
    { permissionName: 'user_manage_hostess', description: 'Créer/modifier/désactiver un compte hôtesse' },
    { permissionName: 'user_manage_manager', description: 'Créer/modifier/désactiver un compte manager' },
    { permissionName: 'user_manage_admin', description: 'Créer/modifier/désactiver un compte admin' },
    { permissionName: 'user_queue_assign', description: 'Affecter/retirer un compte sur une queue' },
    { permissionName: 'user_site_assign', description: 'Affecter/retirer un compte sur un site' },
    { permissionName: 'report_view', description: 'Consulter les rapports' },
    { permissionName: 'system_manage', description: 'Contourne tout filtrage de périmètre (root uniquement)' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { permissionName: perm.permissionName },
      update: { description: perm.description },
      create: perm,
    });
  }
  console.log(`✅ ${permissions.length} permissions insérées/mises à jour`);

  // 2. Rôles (§4.9)
  const roles = [
    { roleName: 'kiosk', rank: 1, description: 'Borne libre-service : inscription client uniquement' },
    { roleName: 'hotesse', rank: 2, description: 'Opère les queues assignées : inscription, guichet, appel, RDV' },
    { roleName: 'manager', rank: 3, description: 'Gère un ou plusieurs sites : queues, forfaits, comptes opérateurs' },
    { roleName: 'admin', rank: 4, description: 'Gère les sites et les managers au niveau système' },
    { roleName: 'root', rank: 5, description: 'Accès total, y compris la gestion des comptes admin' },
  ];

  for (const r of roles) {
    await prisma.role.upsert({
      where: { roleName: r.roleName },
      update: { rank: r.rank, description: r.description },
      create: r,
    });
  }
  console.log(`✅ ${roles.length} rôles insérés/mis à jour`);

  // 3. Mapping Rôles <-> Permissions en cascade stricte (§4.9)
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map(allPerms.map((p) => [p.permissionName, p.permissionId]));

  const rolePermMap: Record<string, string[]> = {
    kiosk: ['queue_view', 'tier_view', 'customer_register'],
    hotesse: [
      'queue_view', 'tier_view', 'customer_register',
      'customer_view', 'customer_edit', 'customer_delete', 'customer_call',
      'session_operate', 'appointment_manage',
      'person_note_view', 'person_note_manage', 'notification_view',
    ],
    manager: [
      'queue_view', 'tier_view', 'customer_register',
      'customer_view', 'customer_edit', 'customer_delete', 'customer_call',
      'session_operate', 'appointment_manage',
      'person_note_view', 'person_note_manage', 'notification_view',
      'site_view', 'site_edit',
      'queue_create', 'queue_edit', 'queue_delete', 'queue_tier_manage',
      'user_manage_kiosk', 'user_manage_hostess', 'user_queue_assign',
      'notification_send', 'report_view',
    ],
    admin: [
      'queue_view', 'tier_view', 'customer_register',
      'customer_view', 'customer_edit', 'customer_delete', 'customer_call',
      'session_operate', 'appointment_manage',
      'person_note_view', 'person_note_manage', 'notification_view',
      'site_view', 'site_edit',
      'queue_create', 'queue_edit', 'queue_delete', 'queue_tier_manage',
      'user_manage_kiosk', 'user_manage_hostess', 'user_queue_assign',
      'notification_send', 'report_view',
      'site_create', 'site_delete', 'user_manage_manager', 'user_site_assign',
      'tier_catalog_manage', 'translation_manage',
    ],
    root: allPerms.map((p) => p.permissionName),
  };

  for (const [roleName, permNames] of Object.entries(rolePermMap)) {
    const role = await prisma.role.findUnique({ where: { roleName } });
    if (!role) continue;

    for (const permName of permNames) {
      const permId = permMap.get(permName);
      if (!permId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.roleId, permissionId: permId } },
        update: {},
        create: { roleId: role.roleId, permissionId: permId },
      });
    }
  }
  console.log('✅ Assignation rôle <-> permissions terminée');

  // 4. Forfaits de service globaux (§3.6)
  const tiers = [
    {
      tierCode: 'free',
      tierName: 'Gratuit',
      isSystem: true,
      description: 'Aucune notification — le client attend sur place',
    },
    {
      tierCode: 'standard',
      tierName: 'Standard',
      isSystem: false,
      description: 'Notification de seuil',
    },
    {
      tierCode: 'premium',
      tierName: 'Premium',
      isSystem: false,
      description: 'Notification de bienvenue + seuil',
    },
    {
      tierCode: 'vip',
      tierName: 'VIP',
      isSystem: false,
      description: 'Notification de bienvenue, lien de suivi et seuil élargi',
    },
  ];

  for (const tier of tiers) {
    await prisma.serviceTier.upsert({
      where: { tierCode: tier.tierCode },
      update: { tierName: tier.tierName, isSystem: tier.isSystem, description: tier.description },
      create: tier,
    });
  }
  console.log(`✅ ${tiers.length} forfaits globaux insérés/mis à jour`);

  // 5. Versions de traductions (§3.13)
  const categories = ['ihm', 'sms', 'error'];
  for (const category of categories) {
    await prisma.translationVersion.upsert({
      where: { category },
      update: {},
      create: { category, version: 1 },
    });
  }

  // 6. Traductions par défaut (§6.7, §4.15)
  const initialTranslations = [
    {
      translationKey: 'ihm.queue.position_update',
      category: 'ihm',
      locale: 'fr',
      content: 'Vous êtes en {position}ᵉ position, environ {minutes} min',
      expectedParams: ['position', 'minutes'],
    },
    {
      translationKey: 'ihm.button.call_next',
      category: 'ihm',
      locale: 'fr',
      content: 'Appeler le suivant',
      expectedParams: [],
    },
    {
      translationKey: 'ihm.status.no_show',
      category: 'ihm',
      locale: 'fr',
      content: 'Absent',
      expectedParams: [],
    },
    {
      translationKey: 'sms.welcome',
      category: 'sms',
      locale: 'fr',
      content: 'Bienvenue chez Dori. Votre ticket est {ticketNumber}. Suivi : {trackingUrl}',
      expectedParams: ['ticketNumber', 'trackingUrl'],
    },
    {
      translationKey: 'sms.threshold_reached',
      category: 'sms',
      locale: 'fr',
      content: '{firstName}, votre tour approche. Ticket {ticketNumber}. Position : {position}, temps estimé : {minutes} min.',
      expectedParams: ['firstName', 'ticketNumber', 'position', 'minutes'],
    },
  ];

  for (const t of initialTranslations) {
    await prisma.translation.upsert({
      where: { uk_translation_key_locale: { translationKey: t.translationKey, locale: t.locale } },
      update: { content: t.content, expectedParams: t.expectedParams, category: t.category },
      create: t,
    });
  }
  console.log(`✅ ${initialTranslations.length} traductions initiales créées`);

  // 7. Compte Utilisateur Initial root (§4.9)
  const rootRole = await prisma.role.findUnique({ where: { roleName: 'root' } });
  if (rootRole) {
    const defaultPassword = process.env.ROOT_INITIAL_PASSWORD || 'RootAdmin2026!';
    const passwordHash = await argon2.hash(defaultPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const rootUser = await prisma.user.upsert({
      where: { username: 'root' },
      update: {},
      create: {
        username: 'root',
        email: 'root@dori.tn',
        passwordHash,
        userType: 'human',
        mustChangePassword: false,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: rootUser.userId, roleId: rootRole.roleId } },
      update: {},
      create: { userId: rootUser.userId, roleId: rootRole.roleId },
    });

    console.log(`Utilisateur root créé/vérifié (username: root)`);
  }

  console.log('Seed DORI terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
