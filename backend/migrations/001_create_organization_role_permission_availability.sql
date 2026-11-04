-- Adds organization-level role and permission availability mappings.
-- Safe to rerun: CREATE TABLE IF NOT EXISTS and INSERT IGNORE use the
-- composite primary keys to avoid duplicate rows.
--
-- The ID columns below use BIGINT UNSIGNED. Confirm that organizations.id,
-- roles.id, and permissions.id use the same type before running this script;
-- MySQL foreign-key column types must match the referenced columns.

CREATE TABLE IF NOT EXISTS organization_roles (
  organization_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, role_id),
  CONSTRAINT fk_organization_roles_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id),
  CONSTRAINT fk_organization_roles_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS organization_permissions (
  organization_id BIGINT UNSIGNED NOT NULL,
  permission_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, permission_id),
  CONSTRAINT fk_organization_permissions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations (id),
  CONSTRAINT fk_organization_permissions_permission
    FOREIGN KEY (permission_id) REFERENCES permissions (id)
) ENGINE=InnoDB;

INSERT IGNORE INTO organization_roles (organization_id, role_id)
SELECT DISTINCT organization_id, role_id
FROM organization_role_permissions;

INSERT IGNORE INTO organization_permissions (organization_id, permission_id)
SELECT DISTINCT organization_id, permission_id
FROM organization_role_permissions;
