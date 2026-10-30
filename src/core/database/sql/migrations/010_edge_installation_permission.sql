INSERT INTO dorify.dori_permission (
  permission_id,
  permission_name,
  description,
  is_active
) VALUES (
  'deed2cb1-026b-4201-a8ef-a626b87aee34',
  'edge_installation_manage',
  'Enregistrer et superviser les installations Dorify intra connectées',
  TRUE
)
ON CONFLICT (permission_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM dorify.dori_role role
JOIN dorify.dori_permission permission
  ON permission.permission_name = 'edge_installation_manage'
WHERE role.role_name = 'root'
ON CONFLICT (role_id, permission_id) DO NOTHING;
