-- Preserve the resume selected at application submission, even if the candidate
-- later uploads a replacement to their profile.
SET @has_application_resume_url = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'applications'
    AND COLUMN_NAME = 'resume_url'
);

SET @application_resume_sql = IF(
  @has_application_resume_url = 0,
  'ALTER TABLE applications ADD COLUMN resume_url VARCHAR(255) NULL',
  'SELECT 1'
);

PREPARE add_application_resume FROM @application_resume_sql;
EXECUTE add_application_resume;
DEALLOCATE PREPARE add_application_resume;
