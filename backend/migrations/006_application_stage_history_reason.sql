-- Add optional comments to stage events in the existing workflow history table.
SET @has_workflow_history_reason = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'workflow_history' AND COLUMN_NAME = 'reason'
);
SET @workflow_history_reason_sql = IF(
  @has_workflow_history_reason = 0,
  'ALTER TABLE workflow_history ADD COLUMN reason TEXT NULL',
  'SELECT 1'
);
PREPARE add_workflow_history_reason FROM @workflow_history_reason_sql;
EXECUTE add_workflow_history_reason;
DEALLOCATE PREPARE add_workflow_history_reason;
