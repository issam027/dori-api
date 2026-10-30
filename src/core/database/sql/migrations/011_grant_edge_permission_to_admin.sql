INSERT INTO dorify.dori_role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM dorify.dori_role role
JOIN dorify.dori_permission permission
  ON permission.permission_name = 'edge_installation_manage'
WHERE role.role_name IN ('root', 'admin')
ON CONFLICT (role_id, permission_id) DO NOTHING;
