
import { getRoles } from "../services/role.service.js";

export async function getRolesController(req, res, next) {
  try {
    const roles = await getRoles();

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
}
