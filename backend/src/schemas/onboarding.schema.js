import { z } from "zod";

const positiveId = z.union([z.number().int().positive().safe(), z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().safe())]);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date");

export const onboardingIdSchema = positiveId;

export const createOnboardingSchema = z.object({
  offer_id: positiveId,
  target_join_date: dateOnly.nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict();

export const updateOnboardingSchema = z.object({
  status: z.enum(["INITIATED", "IN_PROGRESS", "READY_TO_JOIN", "CANCELLED"]).optional(),
  target_join_date: dateOnly.nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide an onboarding field to update");

export const createOnboardingTaskSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  assigned_to_candidate_id: positiveId.optional().nullable(),
  assigned_to_user_id: positiveId.optional().nullable(),
  due_date: dateOnly.nullable().optional(),
}).strict().refine(
  (value) => Number(Boolean(value.assigned_to_candidate_id)) + Number(Boolean(value.assigned_to_user_id)) === 1,
  "Assign the task to exactly one candidate or employee",
);

export const updateOnboardingTaskSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  assigned_to_candidate_id: positiveId.nullable().optional(),
  assigned_to_user_id: positiveId.nullable().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  due_date: dateOnly.nullable().optional(),
  comments: z.string().trim().max(5000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide a task field to update").refine(
  (value) => !(value.assigned_to_candidate_id && value.assigned_to_user_id),
  "A task cannot be assigned to both a candidate and an employee",
);

export const reviewCandidateDocumentSchema = z.object({
  review_status: z.enum(["VERIFIED", "REJECTED"]),
  rejection_reason: z.string().trim().max(5000).nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.review_status === "REJECTED" && !value.rejection_reason?.trim()) {
    context.addIssue({ code: "custom", path: ["rejection_reason"], message: "A rejection reason is required" });
  }
});

export const uploadCandidateDocumentSchema = z.object({
  document_type: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9 _-]+$/),
  file_name: z.string().trim().min(1).max(255),
}).strict();

export function parseOnboardingId(value) {
  const parsed = onboardingIdSchema.safeParse(value);
  if (!parsed.success) {
    const error = new Error("Invalid onboarding or task ID");
    error.statusCode = 400;
    throw error;
  }
  return parsed.data;
}

export function canTransitionOnboardingStatus(current, next) {
  const transitions = {
    INITIATED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["READY_TO_JOIN", "CANCELLED"],
    READY_TO_JOIN: ["CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[current]?.includes(next) ?? false;
}

export function canTransitionOnboardingTaskStatus(current, next) {
  const transitions = {
    PENDING: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  return transitions[current]?.includes(next) ?? false;
}
