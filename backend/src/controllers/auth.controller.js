
import { loginSchema } from "../schemas/auth.schema.js";
import { loginService } from "../services/auth.service.js";

export function currentUserController(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        account_type: "organization_user",
        organization_id: req.user.organization_id,
        organization_slug: req.user.organization_slug,
        organization_name: req.user.organization_name,
        role_id: req.user.role_id,
        role_name: req.user.role_name,
        department_id: req.user.department_id,
      },
    },
  });
}

export async function loginController(req, res) {
  try {
    // 1. Validate the incoming login data
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Please check your login details",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    // 2. Authenticate the user
    const result = await loginService(validation.data);

    // 3. Send the token and user details
    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode === 401 || error.statusCode === 403
          ? error.message
          : "Unable to log in. Please try again later.",
    });
  }
}
