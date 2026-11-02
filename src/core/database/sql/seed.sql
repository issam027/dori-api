-- =====================================================================
-- Dori — données de référence (seed), version nettoyée
-- Idempotent : peut être rejoué sans écraser les modifications faites
-- depuis l'application (traductions, mot de passe root, etc.).
-- Prérequis : migrations/001_schema_final.sql
-- =====================================================================
SET search_path TO dorify, pg_catalog;

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Forfaits (§3.6)
-- ---------------------------------------------------------------------
INSERT INTO dorify.dori_service_tier (tier_id, tier_code, tier_name, is_system, description) VALUES
('72f4df8f-557c-4409-9057-c20c7998579e', 'free',     'Basic',    TRUE,  'Aucune notification — le client attend sur place'),
('2e6c47e4-ac5f-49d9-a041-0fdce7bb25c4', 'standard', 'Standard', FALSE, 'Notification de seuil'),
('e863aa28-cb7e-407e-8c58-eff39e12b08d', 'premium',  'Premium',  FALSE, 'Notification de bienvenue avec lien de suivi + seuil')
ON CONFLICT (tier_code) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2. Rôles (§4.9)
-- ---------------------------------------------------------------------
INSERT INTO dorify.dori_role (role_id, role_name, rank, description) VALUES
('03992398-e7a0-4a18-a4ee-0c8aa338ff16', 'kiosk',   1, 'Borne libre-service ou écran d''affichage : inscription client, recherche et check-in de RDV, affichage de file'),
('330f01bf-c82b-44f0-b596-981ef8122646', 'operator', 2, 'Opère les queues assignées : inscription, guichet, appel, RDV'),
('a21e0a64-2b78-41af-8b47-3244529eb0ac', 'manager',  3, 'Gère un ou plusieurs sites : queues, forfaits, comptes opérateurs'),
('176913f1-3ecd-4cc8-9640-8db2c34721aa', 'admin',    4, 'Gère les sites et les managers au niveau système'),
('45cda55c-50fa-4fc6-a6db-a237e33eae35', 'root',     5, 'Accès total, y compris la gestion des comptes admin')
ON CONFLICT (role_name) DO UPDATE
SET rank = EXCLUDED.rank,
    description = EXCLUDED.description;

-- ---------------------------------------------------------------------
-- 3. Permissions (§4.9) et matrice rôle -> permissions
-- Une seule table de vérité : pour chaque permission, la liste des rôles
-- qui la reçoivent. Le rôle root reçoit toutes les permissions (voir plus bas).
-- ---------------------------------------------------------------------
CREATE TEMP TABLE seed_permission (
    permission_id UUID NOT NULL,
    permission_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    roles TEXT[] NOT NULL
) ON COMMIT DROP;

INSERT INTO seed_permission (permission_id, permission_name, description, roles) VALUES
-- Sites
('afc1b897-2ed8-4f92-884c-665d938bfa81', 'site_view',            'Voir les sites accessibles',                                                   '{kiosk,manager,admin}'),
('117b3938-a2af-4952-9255-3187ded5a399', 'site_create',          'Créer un site',                                                                '{admin}'),
('b69bee11-cf7c-423a-bccc-953f993ee03e', 'site_edit',            'Modifier les détails d''un site',                                              '{manager,admin}'),
('e0480c4b-2c5e-4615-8e44-79f71d41a1ad', 'site_delete',          'Désactiver un site',                                                           '{admin}'),
-- Queues
('47c1a9d4-621d-491c-aeec-d2dbf2a7eaaf', 'queue_view',           'Voir les queues accessibles et leur état',                                     '{kiosk,operator,manager,admin}'),
('5d134522-b5e6-4d99-aa9b-d0face3c4834', 'queue_create',         'Créer une queue',                                                              '{manager,admin}'),
('3bae188b-4449-4640-9b1a-75246903a7d7', 'queue_edit',           'Modifier une queue',                                                           '{manager,admin}'),
('a162187e-1d0e-4405-998b-d3550ceddfdc', 'queue_reset',          'Déclencher la clôture manuelle d''une queue',                                  '{manager,admin}'),
('233d58c2-4d4f-4f57-992f-51215d5e9b91', 'queue_delete',         'Désactiver une queue',                                                         '{manager,admin}'),
-- Forfaits
('820d4cd1-2952-449c-8651-9381743400a4', 'queue_tier_manage',    'Associer un forfait à une queue, fixer tarif et règles de notification',       '{manager,admin}'),
('7996c2f0-19c8-434e-aaf5-e9764b02d825', 'tier_catalog_manage',  'Gérer le catalogue global de forfaits',                                        '{admin}'),
('02eb607e-2038-41fe-bc2c-e907027c3e87', 'tier_view',            'Voir les forfaits proposés par une queue',                                     '{kiosk,operator,manager,admin}'),
-- Guichets
('872e60c1-d91c-465e-8f24-10449dbad975', 'session_operate',      'Ouvrir, reprendre ou fermer un guichet ; consulter guichets et sessions',      '{operator,manager,admin}'),
-- Inscriptions
('350b833b-fac8-4bfd-8713-1292e63af96d', 'registration_register','Inscrire un client (walk-in ou RDV)',                                           '{kiosk,operator,manager,admin}'),
('5ff5a609-ee10-48ab-8152-4e52beea0e15', 'registration_view',    'Consulter la liste des inscriptions d''une queue',                             '{operator,manager,admin}'),
('dbc77adc-99d3-4088-b398-e7535e6718af', 'registration_edit',    'Modifier une inscription',                                                     '{operator,manager,admin}'),
('e1e8774e-65ef-4373-8698-3951acea50b7', 'registration_delete',  'Annuler (soft delete) une inscription',                                        '{operator,manager,admin}'),
('d929c8c2-b806-43db-9c11-a3c1358d7eb3', 'registration_call',    'Appeler le suivant, marquer servi/absent',                                     '{operator,manager,admin}'),
-- Rendez-vous
('2dc6f0c6-7e16-4589-bdd0-5fe49cbe4044', 'appointment_manage',   'Réserver, reprogrammer, annuler un RDV',                                       '{operator,manager,admin}'),
('ec4109b5-3991-424c-8f9e-6b299e162131', 'appointment_lookup',   'Rechercher un RDV par ticket, ou par nom + heure exacte du créneau',           '{kiosk,operator,manager,admin}'),
('8577e904-c5b1-4caa-ada8-6b64e450e072', 'appointment_checkin',  'Pointer l''arrivée d''un rendez-vous déjà réservé, trouvé par recherche',      '{kiosk,operator,manager,admin}'),
-- Personnes
('0109aa86-9a23-49ec-988a-ebe654f24c70', 'person_note_view',     'Consulter les notes attachées à une personne',                                 '{operator,manager,admin}'),
('c4d300e1-7b29-46f2-91a1-d2a8a68be9ce', 'person_note_manage',   'Créer, modifier, supprimer une note',                                          '{operator,manager,admin}'),
-- Notifications et traductions
('df608df9-017f-4bc3-897f-a36a44fcbde3', 'notification_send',    'Renvoyer ou composer manuellement une notification',                           '{manager,admin}'),
('5ec3b4df-1d16-4e37-aade-4f95bf23f829', 'notification_view',    'Consulter l''historique des notifications',                                    '{operator,manager,admin}'),
('41c6ecc4-6ab6-4271-82ff-7aabb19dbbbf', 'translation_manage',   'Gérer le catalogue de traduction (IHM + SMS)',                                 '{admin}'),
-- Comptes et affectations
('b9b35927-84e2-4a25-b598-c1b62747d9dc', 'user_manage_kiosk',    'Créer/modifier/désactiver un compte borne',                                    '{manager,admin}'),
('1851266b-06a4-453b-869f-2ea0c6d68d86', 'user_manage_operator', 'Créer/modifier/désactiver un compte opérateur',                                '{manager,admin}'),
('4242f8ba-e574-45a7-b9bb-d588618a2c0a', 'user_manage_manager',  'Créer/modifier/désactiver un compte manager',                                  '{admin}'),
('db318ac7-a1b6-4e02-963c-6fbb40ad92ba', 'user_manage_admin',    'Créer/modifier/désactiver un compte admin',                                    '{}'),
('489d2c3c-0090-4699-99fa-0a63656c4803', 'user_queue_assign',    'Affecter/retirer un compte sur une queue',                                     '{manager,admin}'),
('1b2f8504-8694-4335-929d-c510fdbd4ead', 'user_site_assign',     'Affecter/retirer un compte sur un site',                                       '{admin}'),
-- Rapports, audit, système
('ae59c0d8-c00a-4a41-ba22-e34e040791f6', 'report_view',          'Consulter les rapports',                                                       '{manager,admin}'),
('6e3fe1b8-8ddb-4454-a4db-70b92639519b', 'audit_view',           'Consulter le journal d''audit dans son périmètre de sites',                    '{manager,admin}'),
('a781c107-52e0-43fa-8e67-9da5a1def864', 'system_manage',        'Ajuster les permissions associées à un rôle et contourner tout filtrage de périmètre (root uniquement)', '{}');

INSERT INTO seed_permission (permission_id, permission_name, description, roles) VALUES
('deed2cb1-026b-4201-a8ef-a626b87aee34', 'edge_installation_manage', 'Enregistrer et superviser les installations Dorify intra connectées', '{admin}');

INSERT INTO dorify.dori_permission (permission_id, permission_name, description)
SELECT permission_id, permission_name, description FROM seed_permission
ON CONFLICT (permission_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = TRUE;

-- kiosk / operator / manager / admin : selon la matrice ci-dessus
INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM seed_permission sp
CROSS JOIN LATERAL unnest(sp.roles) AS granted(role_name)
JOIN dorify.dori_role r ON r.role_name = granted.role_name
JOIN dorify.dori_permission p ON p.permission_name = sp.permission_name
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- root : toutes les permissions
INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dorify.dori_role r
CROSS JOIN dorify.dori_permission p
WHERE r.role_name = 'root'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Traductions (§3.13, §6.7, §4.15)
-- ON CONFLICT DO NOTHING : les textes modifiés via l'application
-- (permission translation_manage) ne sont jamais écrasés par un rejeu.
-- ---------------------------------------------------------------------
INSERT INTO dorify.dori_translation_category_version (category, version) VALUES
('ihm', 1),
('public_ihm', 1),
('sms', 1),
('email', 1),
('error', 1)
ON CONFLICT (category) DO NOTHING;

INSERT INTO dorify.dori_translation (translation_key, category, locale, content, expected_params) VALUES
-- IHM
('ihm.queue.position_update',    'ihm',   'fr', 'Vous êtes en {position}áµ‰ position, environ {minutes} min', ARRAY['position', 'minutes']),
('ihm.button.call_next',         'ihm',   'fr', 'Appeler le suivant', NULL),
('ihm.status.no_show',           'ihm',   'fr', 'Absent', NULL),
-- SMS
('sms.welcome',                  'sms',   'fr', 'Bienvenue. Votre ticket est {ticket}.', ARRAY['ticket']),
('sms.welcome_with_tracking',    'sms',   'fr', 'Bienvenue. Votre ticket est {ticket}. Suivez votre avancée : {trackingUrl}', ARRAY['ticket', 'trackingUrl']),
('sms.threshold',                'sms',   'fr', '{firstName}, votre tour approche. Ticket {ticket}.', ARRAY['firstName', 'ticket']),
('sms.threshold_with_tracking',  'sms',   'fr', '{firstName}, votre tour approche. Ticket {ticket}. Suivi : {trackingUrl}', ARRAY['firstName', 'ticket', 'trackingUrl']),
-- E-mail
('email.welcome',                'email', 'fr', 'Bienvenue. Votre ticket est {ticket}.', ARRAY['ticket']),
('email.welcome_with_tracking',  'email', 'fr', 'Bienvenue. Votre ticket est {ticket}. Suivez votre avancée : {trackingUrl}', ARRAY['ticket', 'trackingUrl']),
('email.threshold',              'email', 'fr', '{firstName}, votre tour approche. Ticket {ticket}.', ARRAY['firstName', 'ticket']),
('email.threshold_with_tracking','email', 'fr', '{firstName}, votre tour approche. Ticket {ticket}. Suivi : {trackingUrl}', ARRAY['firstName', 'ticket', 'trackingUrl'])
ON CONFLICT (translation_key, locale) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. Utilisateur root par défaut
-- Créé une seule fois (DO NOTHING) : un rejeu ne réinitialise plus le mot
-- de passe. Changement obligatoire à la première connexion.
-- ---------------------------------------------------------------------
INSERT INTO dorify.dori_user (
    user_id, username, full_name, email, password_hash,
    user_type, is_active, language_preference, must_change_password
)
VALUES (
    'c778ee3a-7ccb-4761-b3d1-c31325312d6e', 'root', 'Administrateur Root', 'root@dori.local',
    '$2b$12$.FmvVZNIhX19sr9Bslc5G.uRbx7jjjJyafmwvkqIe5GXTb3jz8eB2',
    'human', TRUE, 'fr', TRUE
)
ON CONFLICT (username) DO NOTHING;

INSERT INTO dorify.dori_user_role (user_id, role_id)
SELECT u.user_id, r.role_id
FROM dorify.dori_user u
JOIN dorify.dori_role r ON r.role_name = 'root'
WHERE u.username = 'root'
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
