function createAuthController({ authService, users }) {
  return {
    register: async (req, res, next) => {
      try {
        const result = await authService.register({
          ...req.body,
          ipAddress: req.ip,
        });
        return res.status(201).json({
          status: "success",
          message: "Account created. Check your email to confirm your account.",
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    login: async (req, res, next) => {
      try {
        const result = await authService.login({
          ...req.body,
          ipAddress: req.ip,
        });
        return res.status(200).json({
          status: "success",
          message: "Login successful",
          data: result,
        });
      } catch (error) {
        return next(error);
      }
    },

    requestPasswordReset: async (req, res, next) => {
      try {
        await authService.requestPasswordReset({
          email: req.body.email,
          ipAddress: req.ip,
        });
        return res.status(202).json({
          status: "success",
          message: "If an account exists for that email, a reset link has been sent.",
        });
      } catch (error) {
        return next(error);
      }
    },

    resetPassword: async (req, res, next) => {
      try {
        await authService.resetPassword({
          token: req.body.token,
          password: req.body.password,
          ipAddress: req.ip,
        });
        return res.status(200).json({
          status: "success",
          message: "Password updated. You can now sign in.",
        });
      } catch (error) {
        return next(error);
      }
    },

    confirmEmail: async (req, res, next) => {
      try {
        const user = await authService.confirmEmail(req.query.token);
        return res.status(200).json({
          status: "success",
          message: "Email confirmed successfully",
          data: { user },
        });
      } catch (error) {
        return next(error);
      }
    },

    currentUser: async (req, res, next) => {
      try {
        const user = await users.findPublicById(req.user.id);
        if (!user) {
          return res.status(404).json({ status: "error", message: "Account not found" });
        }
        return res.status(200).json({ status: "success", data: { user } });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = createAuthController;
