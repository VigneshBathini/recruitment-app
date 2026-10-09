import type { Request, Response } from "express";
import { createOrganizationSchema } from "../schemas/organization.schema";
import { createOrganization } from "../services/organization.service";

export async function createOrganizationController(
  req: Request,
  res: Response
) {
  const validation = createOrganizationSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.flatten(),
    });
  }

  try {
    const result = await createOrganization(validation.data);

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create organization failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create organization",
    });
  }
}