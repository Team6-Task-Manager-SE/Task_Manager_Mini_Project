const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 10;

function createAuthRateLimiter(redisClient) {
  const memoryCounters = new Map();

  return async function authRateLimiter(req, res, next) {
    const key = `auth-rate:${req.ip}`;
    let count;
    let ttl = WINDOW_SECONDS;

    try {
      if (redisClient?.isOpen) {
        count = await redisClient.incr(key);
        if (count === 1) await redisClient.expire(key, WINDOW_SECONDS);
        ttl = await redisClient.ttl(key);
      } else {
        const now = Date.now();
        const current = memoryCounters.get(key);
        if (!current || current.expiresAt <= now) {
          memoryCounters.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 });
          count = 1;
        } else {
          current.count += 1;
          count = current.count;
          ttl = Math.ceil((current.expiresAt - now) / 1000);
        }
      }
    } catch (error) {
      console.error("Authentication rate limiter failed:", error.message);
      return res.status(503).json({ status: "error", message: "Authentication service is temporarily unavailable" });
    }

    res.set("X-RateLimit-Limit", String(MAX_REQUESTS));
    res.set("X-RateLimit-Remaining", String(Math.max(0, MAX_REQUESTS - count)));
    if (count > MAX_REQUESTS) {
      res.set("Retry-After", String(Math.max(1, ttl)));
      return res.status(429).json({
        status: "error",
        code: "RATE_LIMITED",
        message: "Too many authentication requests. Please try again shortly.",
      });
    }
    return next();
  };
}

module.exports = createAuthRateLimiter;
