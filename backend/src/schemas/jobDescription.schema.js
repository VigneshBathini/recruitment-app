function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw validationError(`${field} cannot exceed ${maxLength} characters`);
  }
  return trimmed;
}

export function parseJobDescriptionId(value, field = "job description id") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw validationError(`${field} must be a positive integer`);
  }
  return id;
}

export function validateJobDescriptionDraft(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Job description data is required");
  }
  return {
    title: requiredText(data.title, "Title", 200),
    jd_content: requiredText(data.jd_content, "JD content", 20000),
  };
}

export function validateJobDescriptionSubmission(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Approval submission data is required");
  }
  return {
    workflow_id: parseJobDescriptionId(data.workflow_id, "workflow_id"),
  };
}

export function validateJobDescriptionDecision(data, decision) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw validationError("Approval decision data is required");
  }
  const parsed = { step_order: parseJobDescriptionId(data.step_order, "step_order") };
  if (data.comments != null && typeof data.comments !== "string") {
    throw validationError("comments must be a string");
  }
  const comments = data.comments == null ? null : data.comments.trim();
  if (comments && comments.length > 5000) {
    throw validationError("Comments cannot exceed 5000 characters");
  }
  if (decision === "REJECTED" && !comments) {
    throw validationError("A rejection reason is required");
  }
  return { ...parsed, comments };
}
