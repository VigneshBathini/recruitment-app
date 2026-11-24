-- Extend the existing application history to retain polymorphic actors and withdrawal reasons.
SET @has_application_history_actor_type = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_status_history' AND COLUMN_NAME = 'actor_type'
);
SET @application_history_actor_type_sql = IF(
  @has_application_history_actor_type = 0,
  'ALTER TABLE application_status_history ADD COLUMN actor_type VARCHAR(24) NOT NULL DEFAULT ''MANAGEMENT_USER''',
  'SELECT 1'
);
PREPARE add_application_history_actor_type FROM @application_history_actor_type_sql;
EXECUTE add_application_history_actor_type;
DEALLOCATE PREPARE add_application_history_actor_type;

SET @has_application_history_actor_id = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_status_history' AND COLUMN_NAME = 'actor_id'
);
SET @application_history_actor_id_sql = IF(
  @has_application_history_actor_id = 0,
  'ALTER TABLE application_status_history ADD COLUMN actor_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE add_application_history_actor_id FROM @application_history_actor_id_sql;
EXECUTE add_application_history_actor_id;
DEALLOCATE PREPARE add_application_history_actor_id;

UPDATE application_status_history
SET actor_id = changed_by
WHERE actor_id IS NULL AND changed_by IS NOT NULL;

SET @has_application_history_reason = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'application_status_history' AND COLUMN_NAME = 'reason'
);
SET @application_history_reason_sql = IF(
  @has_application_history_reason = 0,
  'ALTER TABLE application_status_history ADD COLUMN reason TEXT NULL',
  'SELECT 1'
);
PREPARE add_application_history_reason FROM @application_history_reason_sql;
EXECUTE add_application_history_reason;
DEALLOCATE PREPARE add_application_history_reason;
