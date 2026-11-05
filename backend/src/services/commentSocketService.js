
const { Server } = require("socket.io");
const { verifyToken } = require("./tokenService");

function createCommentSocketService(httpServer, { tasks }) {
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.FRONTEND_URL || "http://127.0.0.1:5173",
      methods: ["GET", "POST"],
    },
  });

  // Authenticate every socket connection.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = verifyToken(token, "access");

      socket.user = {
        id: Number(payload.sub),
        role: payload.role,
      };

      if (!Number.isSafeInteger(socket.user.id) || socket.user.id <= 0) {
        return next(new Error("Invalid user"));
      }

      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("task:join", async (taskId, acknowledge) => {
      const respond =
        typeof acknowledge === "function" ? acknowledge : () => {};

      try {
        const id = Number(taskId);

        if (!Number.isSafeInteger(id) || id <= 0) {
          return respond({ success: false, message: "Invalid task ID" });
        }

        const task = await tasks.getById(id);

        if (!task || task.projectId == null) {
          return respond({ success: false, message: "Task not found" });
        }

        const allowed = await tasks.canAccessProject(
          task.projectId,
          socket.user.id
        );

        if (!allowed) {
          return respond({ success: false, message: "Project access denied" });
        }

        await socket.join(`task:${id}`);

        return respond({ success: true });
      } catch (error) {
        console.error("Comment socket join failed:", error);
        return respond({ success: false, message: "Unable to join task" });
      }
    });

    socket.on("task:leave", async (taskId) => {
      const id = Number(taskId);

      if (Number.isSafeInteger(id) && id > 0) {
        await socket.leave(`task:${id}`);
      }
    });
  });

  return {
    io,
    close: () => io.close(),
  };
}

module.exports = { createCommentSocketService };
