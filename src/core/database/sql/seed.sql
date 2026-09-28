-- Seed Data according to §3.6, §3.13, §4.9

-- 1. Service Tiers (§3.6)
INSERT INTO dori_service_tier (tier_code, tier_name, is_system, description) VALUES
('free',     'Gratuit',  TRUE,  'Aucune notification — le client attend sur place'),
('standard', 'Standard', FALSE, 'Notification de seuil'),
('premium',  'Premium',  FALSE, 'Notification de bienvenue avec lien de suivi + seuil')
ON CONFLICT (tier_code) DO NOTHING;

-- 2. Permissions (§4.9)
INSERT INTO dori_permission (permission_name, description) VALUES
('site_view',              'Voir les sites accessibles'),
('site_create',            'Créer un site'),
('site_edit',              'Modifier les détails d''un site'),
('site_delete',            'Désactiver un site'),
('queue_view',             'Voir les queues accessibles et leur état'),
('queue_create',           'Créer une queue'),
('queue_edit',             'Modifier une queue, déclencher sa clôture'),
('queue_delete',           'Désactiver une queue'),
('queue_tier_manage',      'Associer un forfait à une queue, fixer tarif et règles de notification'),
('tier_catalog_manage',    'Gérer le catalogue global de forfaits'),
('tier_view',              'Voir les forfaits proposés par une queue'),
('session_operate',        'Ouvrir, reprendre ou fermer un guichet ; consulter guichets et sessions'),
('customer_register',      'Inscrire un client (walk-in ou RDV)'),
('customer_view',          'Consulter la liste des inscriptions d''une queue'),
('customer_edit',          'Modifier une inscription'),
('customer_delete',        'Annuler (soft delete) une inscription'),
('customer_call',          'Appeler le suivant, marquer servi/absent'),
('appointment_manage',     'Réserver, reprogrammer, annuler un RDV'),
('appointment_lookup',     'Rechercher un RDV par ticket, ou par nom + heure exacte du créneau'),
('appointment_checkin',    'Pointer l''arrivée d''un rendez-vous déjà réservé, trouvé par recherche'),
('person_note_view',       'Consulter les notes attachées à une personne'),
('person_note_manage',     'Créer, modifier, supprimer une note'),
('notification_send',      'Renvoyer ou composer manuellement une notification'),
('notification_view',      'Consulter l''historique des notifications'),
('translation_manage',     'Gérer le catalogue de traduction (IHM + SMS)'),
('user_manage_kiosk',      'Créer/modifier/désactiver un compte borne'),
('user_manage_hostess',    'Créer/modifier/désactiver un compte hôtesse'),
('user_manage_manager',    'Créer/modifier/désactiver un compte manager'),
('user_manage_admin',      'Créer/modifier/désactiver un compte admin'),
('user_queue_assign',      'Affecter/retirer un compte sur une queue'),
('user_site_assign',       'Affecter/retirer un compte sur un site'),
('report_view',            'Consulter les rapports'),
('system_manage',          'Ajuster les permissions associées à un rôle et contourner tout filtrage de périmètre (root uniquement)')
ON CONFLICT (permission_name) DO NOTHING;

-- 3. Roles (§4.9)
INSERT INTO dori_role (role_name, rank, description) VALUES
('kiosk',   1, 'Borne libre-service ou écran d''affichage : inscription client, recherche et check-in de RDV, affichage de file'),
('hotesse', 2, 'Opère les queues assignées : inscription, guichet, appel, RDV'),
('manager', 3, 'Gère un ou plusieurs sites : queues, forfaits, comptes opérateurs'),
('admin',   4, 'Gère les sites et les managers au niveau système'),
('root',    5, 'Accès total, y compris la gestion des comptes admin')
ON CONFLICT (role_name) DO NOTHING;

-- 4. Role - Permissions Mapping (§4.9)
-- Kiosk
INSERT INTO dori_role_permission (role_id, permission_id)
SELECT (SELECT role_id FROM dori_role WHERE role_name='kiosk'), permission_id
FROM dori_permission WHERE permission_name IN (
  'queue_view','tier_view','customer_register',
  'appointment_lookup','appointment_checkin'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Hotesse
INSERT INTO dori_role_permission (role_id, permission_id)
SELECT (SELECT role_id FROM dori_role WHERE role_name='hotesse'), permission_id
FROM dori_permission WHERE permission_name IN (
  'queue_view','tier_view','customer_register',
  'customer_view','customer_edit','customer_delete','customer_call',
  'session_operate','appointment_manage',
  'appointment_lookup','appointment_checkin',
  'person_note_view','person_note_manage','notification_view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manager
INSERT INTO dori_role_permission (role_id, permission_id)
SELECT (SELECT role_id FROM dori_role WHERE role_name='manager'), permission_id
FROM dori_permission WHERE permission_name IN (
  'queue_view','tier_view','customer_register',
  'customer_view','customer_edit','customer_delete','customer_call',
  'session_operate','appointment_manage',
  'appointment_lookup','appointment_checkin',
  'person_note_view','person_note_manage','notification_view',
  'site_view','site_edit',
  'queue_create','queue_edit','queue_delete','queue_tier_manage',
  'user_manage_kiosk','user_manage_hostess','user_queue_assign',
  'notification_send','report_view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin
INSERT INTO dori_role_permission (role_id, permission_id)
SELECT (SELECT role_id FROM dori_role WHERE role_name='admin'), permission_id
FROM dori_permission WHERE permission_name IN (
  'queue_view','tier_view','customer_register',
  'customer_view','customer_edit','customer_delete','customer_call',
  'session_operate','appointment_manage',
  'appointment_lookup','appointment_checkin',
  'person_note_view','person_note_manage','notification_view',
  'site_view','site_edit',
  'queue_create','queue_edit','queue_delete','queue_tier_manage',
  'user_manage_kiosk','user_manage_hostess','user_queue_assign',
  'notification_send','report_view',
  'site_create','site_delete','user_manage_manager','user_site_assign',
  'tier_catalog_manage','translation_manage'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Root (all permissions)
INSERT INTO dori_role_permission (role_id, permission_id)
SELECT (SELECT role_id FROM dori_role WHERE role_name='root'), permission_id
FROM dori_permission
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Translation Versions (§3.13)
INSERT INTO dori_translation_version (category, version) VALUES
('ihm', 1),
('sms', 1),
('error', 1)
ON CONFLICT (category) DO NOTHING;

-- 6. Core Translations (§6.7, §4.15)
INSERT INTO dori_translation (translation_key, category, locale, content, expected_params) VALUES
('ihm.queue.position_update', 'ihm', 'fr', 'Vous êtes en {position}ᵉ position, environ {minutes} min', ARRAY['position', 'minutes']),
('ihm.button.call_next', 'ihm', 'fr', 'Appeler le suivant', NULL),
('ihm.status.no_show', 'ihm', 'fr', 'Absent', NULL),
('sms.welcome', 'sms', 'fr', 'Bienvenue. Votre ticket est {ticket}. Suivez votre avancée : {trackingUrl}', ARRAY['ticket', 'trackingUrl']),
('sms.threshold_reached', 'sms', 'fr', '{firstName}, votre tour approche. Ticket {ticket}.', ARRAY['firstName', 'ticket'])
ON CONFLICT (translation_key, locale) DO NOTHING;

-- 7. Default Root User (password: Root@123456)
INSERT INTO dori_user (username, email, password_hash, user_type, is_active, language_preference)
VALUES ('root', 'root@dori.local', '$2b$12$.FmvVZNIhX19sr9Bslc5G.uRbx7jjjJyafmwvkqIe5GXTb3jz8eB2', 'human', TRUE, 'fr')
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Assign root role to root user
INSERT INTO dori_user_role (user_id, role_id)
SELECT (SELECT user_id FROM dori_user WHERE username='root'),
       (SELECT role_id FROM dori_role WHERE role_name='root')
ON CONFLICT (user_id, role_id) DO NOTHING;
