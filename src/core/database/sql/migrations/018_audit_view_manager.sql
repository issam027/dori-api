INSERT INTO dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dori_role r
CROSS JOIN dori_permission p
WHERE r.role_name = 'manager'
  AND p.permission_name = 'audit_view'
ON CONFLICT (role_id, permission_id) DO NOTHING;