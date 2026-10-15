import pg from 'pg';
import { config } from './env.config.js';

const { Pool } = pg;

/**
 * Universal Production PostgreSQL Connection Pool
 * Supports both individual credentials (DB_HOST, DB_USER, etc.)
 * and Cloud connection strings (DATABASE_URL for Render, Supabase, Neon, Railway).
 */
const POOL_MAX = config.db.connectionLimit || 5;

const poolConfig = config.db.url
  ? {
      // Use the Neon *pooled* host (-pooler) with ?sslmode=require in DATABASE_URL.
      connectionString: config.db.url,
      // Neon presents a publicly trusted certificate, so full verification works.
      ssl: config.db.ssl,
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      max: POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      options: '-c timezone=Asia/Calcutta'
    };

const pgPool = new Pool(poolConfig);

pgPool.on('error', (err) => {
  console.error('⚠️ Unexpected idle PostgreSQL client error:', err.message);
});

/**
 * Intelligent query translator:
 * 1. Converts MySQL '?' placeholders into PostgreSQL '$1, $2, ...'
 * 2. Unpacks 1D array parameters for 'IN (?)'
 * 3. Unpacks 2D array parameters for bulk 'VALUES ?'
 * 4. Translates case-insensitive 'LIKE' to 'ILIKE'
 * 5. Appends 'RETURNING id' to INSERT statements for insertId capture
 */
export function translateQuery(sql, params = []) {
  if (!sql || typeof sql !== 'string') {
    return { sql, params };
  }

  // Handle special session commands like SET time_zone
  if (/^\s*SET\s+time_zone/i.test(sql)) {
    return { sql: "SET timezone = '+05:30'", params: [] };
  }
  // If query already uses PostgreSQL $1 style parameters and no ?, pass through directly
  if (/\$\d+/.test(sql) && !/\?/.test(sql)) {
    return { sql, params };
  }

  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(sql)) {
    sql = sql.replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+[\w\s=]+/gi, 'ON CONFLICT DO NOTHING');
  }
  if (/INSERT\s+IGNORE\s+INTO/i.test(sql)) {
    sql = sql.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT INTO');
    if (!/ON\s+CONFLICT/i.test(sql)) {
      sql = sql.trimEnd().replace(/;+$/, '') + ' ON CONFLICT DO NOTHING';
    }
  }

  if (!params || params.length === 0) {
    let cleanSql = sql.replace(/\bLIKE\b/gi, 'ILIKE').replace(/`/g, '"');
    if (/^\s*INSERT\s+INTO\s+/i.test(cleanSql) && !/\bRETURNING\b/i.test(cleanSql)) {
      cleanSql = cleanSql.trimEnd().replace(/;+$/, '');
      cleanSql += ' RETURNING id';
    }
    return { sql: cleanSql, params: [] };
  }

  let paramIndex = 1;
  const newParams = [];
  let newSql = '';
  let inString = false;
  let quoteChar = '';
  let pIdx = 0;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (inString) {
      newSql += char;
      if (char === quoteChar && sql[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      quoteChar = char;
      newSql += char;
      continue;
    }

    // Convert MySQL backtick identifier quotes to standard PostgreSQL double quotes
    if (char === '`') {
      newSql += '"';
      continue;
    }

    if (char === '?') {
      const val = params[pIdx++];
      if (Array.isArray(val)) {
        if (val.length === 0) {
          // Empty array for IN (?) -> return FALSE condition or NULL
          const trimmed = newSql.trimEnd();
          if (trimmed.endsWith('(')) {
            newSql += 'NULL';
          } else {
            newSql += '(NULL)';
          }
        } else if (Array.isArray(val[0])) {
          // 2D Array for bulk INSERT VALUES ?
          const rowPlaceholders = [];
          for (const row of val) {
            const cols = [];
            for (const colVal of row) {
              cols.push(`$${paramIndex++}`);
              newParams.push(colVal);
            }
            rowPlaceholders.push(`(${cols.join(', ')})`);
          }
          newSql += rowPlaceholders.join(', ');
        } else {
          // 1D Array for IN (?)
          const placeholders = [];
          for (const item of val) {
            placeholders.push(`$${paramIndex++}`);
            newParams.push(item);
          }
          const trimmed = newSql.trimEnd();
          if (trimmed.endsWith('(')) {
            newSql += placeholders.join(', ');
          } else {
            newSql += `(${placeholders.join(', ')})`;
          }
        }
      } else {
        newSql += `$${paramIndex++}`;
        newParams.push(val);
      }
      continue;
    }

    newSql += char;
  }

  newSql = newSql.replace(/\bLIKE\b/gi, 'ILIKE');

  if (/^\s*INSERT\s+INTO\s+/i.test(newSql) && !/\bRETURNING\b/i.test(newSql)) {
    newSql = newSql.trimEnd().replace(/;+$/, '');
    newSql += ' RETURNING id';
  }

  return { sql: newSql, params: newParams };
}

/**
 * Format PostgreSQL query response to mirror MySQL [rows, resultMeta]
 */
function formatResult(res) {
  const rows = res.rows || [];
  const insertId = rows[0]?.id || null;
  const affectedRows = res.rowCount || 0;

  // Attach MySQL-compatible metadata directly onto rows Array
  rows.insertId = insertId;
  rows.affectedRows = affectedRows;
  rows.rowCount = affectedRows;

  const resultMeta = {
    insertId,
    affectedRows,
    rowCount: affectedRows
  };
  return [rows, resultMeta];
}

/**
 * Wrapped DB Pool compatible with existing MySQL codebase patterns
 */
const pool = {
  async query(rawSql, rawParams = []) {
    const { sql, params } = translateQuery(rawSql, rawParams);
    const res = await pgPool.query(sql, params);
    return formatResult(res);
  },

  async getConnection() {
    const client = await pgPool.connect();

    return {
      async query(rawSql, rawParams = []) {
        const { sql, params } = translateQuery(rawSql, rawParams);
        const res = await client.query(sql, params);
        return formatResult(res);
      },
      async beginTransaction() {
        return client.query('BEGIN');
      },
      async commit() {
        return client.query('COMMIT');
      },
      async rollback() {
        return client.query('ROLLBACK');
      },
      release() {
        return client.release();
      }
    };
  },

  async end() {
    return pgPool.end();
  }
};

/**
 * Helper to test database connection on server startup
 */
export const testDbConnection = async () => {
  try {
    const res = await pgPool.query('SELECT NOW() AS current_time, current_database() AS db_name');
    const { current_time, db_name } = res.rows[0];
    console.log(`✅ Connected to PostgreSQL Database (${db_name}) successfully via connection pool.`);
    console.log(`⏰ PostgreSQL Server Time: ${current_time}`);
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL Database connection failed:', error.message);
    // Common deploy mistake: the template value from .env.production.example was pasted as-is
    if (/USER:PASSWORD|\.REGION\.|ep-xxxx/i.test(process.env.DATABASE_URL || '')) {
      console.error('👉 DATABASE_URL still contains the placeholder from .env.production.example. Replace it with your real Neon pooled connection string (Neon dashboard > Connect) in Render > Environment.');
    }
    throw error;
  }
};

export default pool;
