
import { loginSchema } from "../schemas/auth.schema.js";
import { loginService } from "../services/auth.service.js";

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
