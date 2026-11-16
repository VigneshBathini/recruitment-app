-- Adds JD and job lifecycle permissions without changing the database schema.
INSERT INTO permissions (name, description)
SELECT 'job.view', 'View organization job descriptions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'job.view');

INSERT INTO permissions (name, description)
SELECT 'job.manage', 'Create, edit, and submit organization job descriptions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'job.manage');

INSERT INTO permissions (name, description)
SELECT 'job.approve', 'Approve or reject organization job descriptions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'job.approve');

INSERT INTO permissions (name, description)
SELECT 'job.publish', 'Publish approved organization job descriptions'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'job.publish');

INSERT IGNORE INTO organization_permissions (organization_id, permission_id)
SELECT o.id, p.id
FROM organizations o
CROSS JOIN permissions p
WHERE p.name IN ('job.view', 'job.manage', 'job.approve', 'job.publish');
