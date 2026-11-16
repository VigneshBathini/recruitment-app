-- Run directly in MySQL if either application permission is not already present.
-- Then grant it to the appropriate organization roles through Role & Permissions.
INSERT INTO permissions (name, description)
SELECT 'application.view', 'View organization applications and candidate application details'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE name = 'application.view'
);

INSERT INTO permissions (name, description)
SELECT 'application.manage', 'Move, shortlist, and reject organization applications'
WHERE NOT EXISTS (
  SELECT 1 FROM permissions WHERE name = 'application.manage'
);
