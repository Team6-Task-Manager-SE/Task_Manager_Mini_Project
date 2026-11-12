const crypto = require("node:crypto");

function createProjectInvitationService({
  invitationRepository,
  emailService,
  frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:5173",
}) {
  return {
    async inviteUser({ projectId, inviterId, invitedEmail }) {
      const email = String(invitedEmail || "").trim().toLowerCase();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { status: "invalid_email" };
      }

      // Generate a secure, unpredictable invitation token.
      const token = crypto.randomBytes(32).toString("hex");

      // Store only the SHA-256 hash, never the raw token.
      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      // Seven days is an implementation choice for this feature.
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );

      const result = await invitationRepository.createInvitation({
        projectId,
        inviterId,
        invitedEmail: email,
        tokenHash,
        expiresAt,
      });

      if (result.status !== "created") {
        return result;
      }

      const invitationLink =
        `${frontendUrl.replace(/\/$/, "")}/accept-invitation?token=${token}`;

      await emailService.sendProjectInvitation({
        email: result.invitedUser.email,
        name: result.invitedUser.name,
        projectName: result.project.name,
        invitationLink,
      });

      return {
        status: "created",
        invitation: result.invitation,
      };
    },

    async acceptInvitation({ token, userId }) {
      if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(token)
      ) {
        return { status: "invalid_invitation" };
      }

      const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      return invitationRepository.acceptInvitation({
        tokenHash,
        userId,
      });
    },
  };
}

module.exports = { createProjectInvitationService };
