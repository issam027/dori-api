INSERT INTO dori_permission (permission_name, description)
VALUES ('audit_view', 'Consulter le journal d''audit dans son périmètre de sites')
ON CONFLICT (permission_name) DO UPDATE
SET description = EXCLUDED.description,
    is_active = TRUE;

INSERT INTO dori_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM dori_role r
CROSS JOIN dori_permission p
WHERE r.role_name IN ('manager', 'admin', 'root')
  AND p.permission_name = 'audit_view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
