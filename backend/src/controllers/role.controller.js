
import { getRoles } from "../services/role.service.js";

export async function getRolesController(req, res, next) {
  try {
    const requestedId = req.query.organizationId;
    const organizationId = req.user.account_type === "organization_user"
      ? req.user.organization_id
      : Number(requestedId);
    if (!Number.isSafeInteger(Number(organizationId)) || Number(organizationId) <= 0 ||
        (req.user.account_type === "organization_user" && requestedId != null && Number(requestedId) !== req.user.organization_id)) {
      return res.status(400).json({ success: false, message: "A valid organization scope is required" });
    }
    const roles = await getRoles(Number(organizationId));
    if (roles === null) return res.status(404).json({ success: false, message: "Organization not found" });

    return res.status(200).json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
}
