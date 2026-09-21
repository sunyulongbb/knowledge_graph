type SqliteLike = {
  query(sql: string): {
    get(...params: any[]): any;
  };
  run(sql: string, params?: any[]): any;
};

type PasswordHash = {
  salt: string;
  hash: string;
};

export type InitialAdminCredentials = {
  username: string;
  password: string;
};

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%_-";

export function generateInitialAdminPassword(length = 20): string {
  const size = Math.max(16, Math.floor(length));
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length],
  ).join("");
}

export async function ensureInitialAdminAccount(
  database: SqliteLike,
  passwordHasher: (password: string) => Promise<PasswordHash>,
  passwordFactory: () => string = generateInitialAdminPassword,
): Promise<InitialAdminCredentials | null> {
  const count = Number(
    database.query("SELECT COUNT(*) AS count FROM users").get()?.count || 0,
  );
  if (count > 0) return null;

  const username = "admin";
  const password = passwordFactory();
  const passwordHash = await passwordHasher(password);
  if (!passwordHash.hash || !passwordHash.salt) {
    throw new Error("无法生成初始管理员密码哈希");
  }

  database.run("BEGIN IMMEDIATE");
  try {
    // Recheck inside the write transaction in case another process initialized
    // the same database while the password hash was being generated.
    const transactionalCount = Number(
      database.query("SELECT COUNT(*) AS count FROM users").get()?.count || 0,
    );
    if (transactionalCount > 0) {
      database.run("ROLLBACK");
      return null;
    }

    database.run(
      `INSERT INTO users
       (username, display_name, password_hash, password_salt, role, status, is_admin)
       VALUES (?, ?, ?, ?, 'admin', 'active', 1)`,
      [username, "系统管理员", passwordHash.hash, passwordHash.salt],
    );
    database.run(
      `INSERT OR IGNORE INTO user_roles (user_id, role_id)
       SELECT u.id, r.id
       FROM users u
       JOIN roles r ON r.code = 'super_admin'
       WHERE u.username = ?`,
      [username],
    );
    database.run("COMMIT");
    return { username, password };
  } catch (error) {
    try {
      database.run("ROLLBACK");
    } catch {}
    throw error;
  }
}
