CREATE TABLE IF NOT EXISTS workflow_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(40) NOT NULL,
  field_name VARCHAR(64) NULL,
  previous_value TEXT NULL,
  new_value TEXT NULL,
  actor_type VARCHAR(24) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_workflow_history_entity (organization_id, entity_type, entity_id, created_at),
  KEY idx_workflow_history_actor (organization_id, actor_type, actor_id)
);
