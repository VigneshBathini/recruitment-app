function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function parseOfferId(value, field = "offer id") {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw validationError(`${field} must be a positive integer`);
  return id;
}

function parseAnnualCtc(value) {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(?:\.\d{1,2})?$/.test(String(value).trim())) {
    throw validationError("annual_ctc must be a positive amount with up to two decimal places");
  }
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99) {
    throw validationError("annual_ctc must be a positive amount within the supported range");
  }
  return amount.toFixed(2);
}

function parseCurrency(value) {
  if (typeof value !== "string") throw validationError("currency must be a three-letter ISO currency code");
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency) || !Intl.supportedValuesOf("currency").includes(currency)) {
    throw validationError("currency must be a supported three-letter ISO currency code");
  }
  return currency;
}

function parseEmploymentType(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 50) {
    throw validationError("employment_type is required and must be at most 50 characters");
  }
  return value.trim();
}

function parseDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw validationError(`${field} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw validationError(`${field} must be a valid calendar date`);
  }
  return value;
}

export function validateOfferTerms(data, { partial = false } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw validationError("Offer data must be an object");
  const result = {};
  const requiredFields = {
    annual_ctc: parseAnnualCtc,
    currency: parseCurrency,
    employment_type: parseEmploymentType,
    start_date: (value) => parseDate(value, "start_date"),
  };
  for (const [field, parser] of Object.entries(requiredFields)) {
    if (data[field] === undefined && partial) continue;
    result[field] = parser(data[field]);
  }
  if (!partial) {
    result.expiry_date = data.expiry_date == null ? null : parseDate(data.expiry_date, "expiry_date");
    result.work_location = data.work_location == null ? null : parseOptionalText(data.work_location, "work_location", 255);
    result.offer_letter_url = data.offer_letter_url == null ? null : parseOptionalText(data.offer_letter_url, "offer_letter_url", 500);
  }
  if (partial) {
    for (const field of ["expiry_date", "work_location", "offer_letter_url"]) {
      if (Object.hasOwn(data, field)) {
        if (field === "expiry_date") result[field] = data[field] == null ? null : parseDate(data[field], field);
        else result[field] = data[field] == null ? null : parseOptionalText(data[field], field, field === "work_location" ? 255 : 500);
      }
    }
  }
  const startDate = result.start_date ?? data.start_date;
  const expiryDate = Object.hasOwn(result, "expiry_date") ? result.expiry_date : data.expiry_date;
  if (expiryDate && startDate && new Date(`${expiryDate}T00:00:00.000Z`) <= new Date(`${startDate}T00:00:00.000Z`)) {
    throw validationError("expiry_date must be later than start_date");
  }
  return result;
}

function parseOptionalText(value, field, maxLength) {
  if (typeof value !== "string") throw validationError(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw validationError(`${field} cannot exceed ${maxLength} characters`);
  return trimmed || null;
}

export function validateOfferSubmission(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw validationError("Approval submission data is required");
  return { workflow_id: parseOfferId(data.workflow_id, "workflow_id") };
}
