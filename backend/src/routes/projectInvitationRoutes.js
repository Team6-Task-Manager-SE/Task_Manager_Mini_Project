
const express = require("express");
const authenticate = require("../middleware/authenticate");

function createProjectInvitationRouter({ invitationService }) {
  const router = express.Router();

  // All invitation endpoints require authentication.
  router.use(authenticate);

  // F-040: Invite a registered user to a project.
  router.post("/projects/:projectId/members", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;

      if (!/^\d+$/.test(projectId) || Number(projectId) < 1) {
        return res.status(400).json({
          status: "error",
          code: "INVALID_PROJECT_ID",
          message: "A valid project ID is required",
        });
      }

      const result = await invitationService.inviteUser({
        projectId,
        inviterId: req.user.id,
        invitedEmail: req.body.email,
      });

      if (result.status === "invalid_email") {
        return res.status(400).json({
          status: "error",
          code: "INVALID_EMAIL",
          message: "A valid email address is required",
        });
      }

      if (result.status === "forbidden") {
        return res.status(403).json({
          status: "error",
          code: "PROJECT_OWNER_REQUIRED",
          message: "Only the project owner can invite members",
        });
      }

      if (result.status === "user_not_found") {
        return res.status(404).json({
          status: "error",
          code: "USER_NOT_FOUND",
          message: "No registered user was found with that email",
        });
      }

      if (result.status === "cannot_invite_self") {
        return res.status(400).json({
          status: "error",
          code: "CANNOT_INVITE_SELF",
          message: "You cannot invite yourself",
        });
      }

      if (result.status === "duplicate_invitation") {
        return res.status(409).json({
          status: "error",
          code: "INVITATION_ALREADY_PENDING",
          message: "A pending invitation already exists",
        });
      }

      return res.status(201).json({
        status: "success",
        message: "Project invitation sent successfully",
        data: result.invitation,
      });
    } catch (error) {
      next(error);
    }
  });

  // F-040: Accept an invitation.
  router.post("/project-invitations/accept", async (req, res, next) => {
    try {
      const result = await invitationService.acceptInvitation({
        token: req.body.token,
        userId: req.user.id,
      });

      if (result.status === "wrong_user") {
        return res.status(403).json({
          status: "error",
          code: "INVITATION_USER_MISMATCH",
          message: "This invitation belongs to another user",
        });
      }

      if (
        result.status === "invalid_invitation" ||
        result.status === "expired"
      ) {
        return res.status(400).json({
          status: "error",
          code: "INVALID_OR_EXPIRED_INVITATION",
          message: "This invitation is invalid or has expired",
        });
      }

      if (result.status === "already_accepted") {
        return res.status(409).json({
          status: "error",
          code: "INVITATION_ALREADY_ACCEPTED",
          message: "This invitation has already been accepted",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "You have joined the project successfully",
        data: {
          projectId: result.projectId,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createProjectInvitationRouter;
