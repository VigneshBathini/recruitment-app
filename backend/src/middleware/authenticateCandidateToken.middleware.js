import jwt from "jsonwebtoken";
import { findCandidateById } from "../repositories/candidate.repository.js";

export async function authenticateCandidateToken(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication token is required" });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Authentication service is not configured" });
  }

  let decoded;
  try {
    decoded = jwt.verify(authorization.slice(7), secret);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired authentication token" });
  }
  if (typeof decoded === "string" || decoded.account_type !== "candidate" || !decoded.sub || !decoded.organization_id) {
    return res.status(401).json({ success: false, message: "Invalid candidate authentication token" });
  }
  const candidateId = Number(decoded.sub);
  const organizationId = Number(decoded.organization_id);
  if (!Number.isSafeInteger(candidateId) || candidateId <= 0 || !Number.isSafeInteger(organizationId) || organizationId <= 0) {
    return res.status(401).json({ success: false, message: "Invalid candidate authentication token" });
  }

  try {
    const candidate = await findCandidateById(candidateId);
    if (!candidate || Number(candidate.organization_id) !== organizationId) {
      return res.status(401).json({ success: false, message: "Candidate account no longer exists" });
    }
    if (Number(candidate.is_active) !== 1 || Number(candidate.organization_is_active) !== 1) {
      return res.status(403).json({ success: false, message: "Candidate or organization account is inactive" });
    }
    req.candidate = {
      id: Number(candidate.id),
      organization_id: Number(candidate.organization_id),
      account_type: "candidate",
      first_name: candidate.first_name,
      last_name: candidate.last_name,
      email: candidate.email,
    };
    return next();
  } catch (error) {
    console.error("Candidate session validation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to validate candidate session" });
  }
}
