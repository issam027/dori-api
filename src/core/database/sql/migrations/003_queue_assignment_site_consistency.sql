-- Every queue assignment implies an assignment to the queue's parent site.
INSERT INTO dori_user_site_assignment (
  user_id,
  site_id,
  assigned_at,
  assigned_by_user_id
)
SELECT DISTINCT ON (uq.user_id, q.site_id)
  uq.user_id,
  q.site_id,
  uq.assigned_at,
  uq.assigned_by_user_id
FROM dori_user_queue_assignment uq
JOIN dori_queue q ON q.queue_id = uq.queue_id
ORDER BY uq.user_id, q.site_id, uq.assigned_at
ON CONFLICT (user_id, site_id) DO NOTHING;
