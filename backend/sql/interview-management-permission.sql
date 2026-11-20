-- Missing from the repository's permission definitions. Run only after review.
INSERT INTO permissions (name, description)
SELECT 'interview.view', 'View organization interviews or interviews assigned to the interviewer'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='interview.view');
INSERT INTO permissions (name, description)
SELECT 'interview.manage', 'Schedule, reschedule, and cancel organization interviews'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='interview.manage');
INSERT INTO permissions (name, description)
SELECT 'interview.feedback', 'Submit feedback for assigned interviews'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name='interview.feedback');
-- Grant interview.view and interview.feedback to Interviewer; grant interview.view and interview.manage to Recruiter
-- through the existing Role & Permissions UI for each organization.
