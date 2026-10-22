function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    emailConfirmed: row.email_confirmed,
    createdAt: row.created_at,
  };
}

function createUserRepository(pool) {
  return {
    async findByEmail(email) {
      const result = await pool.query(
        `SELECT id, name, email, password_hash, role, email_confirmed,
                failed_login_attempts, locked_until, created_at
           FROM users
          WHERE LOWER(email) = LOWER($1)`,
        [email]
      );
      return result.rows[0] || null;
    },

    async findPublicById(id) {
      const result = await pool.query(
        `SELECT id, name, email, role, email_confirmed, created_at
           FROM users WHERE id = $1`,
        [id]
      );
      return toPublicUser(result.rows[0]);
    },

    async create({ name, email, passwordHash }) {
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, LOWER($2), $3)
         RETURNING id, name, email, role, email_confirmed, created_at`,
        [name, email, passwordHash]
      );
      return toPublicUser(result.rows[0]);
    },

    async recordFailedLogin(userId) {
      const result = await pool.query(
        `UPDATE users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE
                  WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                  ELSE locked_until
                END,
                updated_at = NOW()
          WHERE id = $1
          RETURNING failed_login_attempts, locked_until`,
        [userId]
      );
      return result.rows[0];
    },

    async resetFailedLogins(userId) {
      await pool.query(
        `UPDATE users
            SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
          WHERE id = $1`,
        [userId]
      );
    },

    async confirmEmail(userId) {
      const result = await pool.query(
        `UPDATE users SET email_confirmed = TRUE, updated_at = NOW()
          WHERE id = $1
          RETURNING id, name, email, role, email_confirmed, created_at`,
        [userId]
      );
      return toPublicUser(result.rows[0]);
    },

    async addAuditLog({ userId, eventType, ipAddress, metadata = {} }) {
      await pool.query(
        `INSERT INTO audit_logs (user_id, event_type, ip_address, metadata)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [userId || null, eventType, ipAddress || null, JSON.stringify(metadata)]
      );
    },
  };
}

module.exports = { createUserRepository, toPublicUser };
