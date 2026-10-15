import { testDbConnection } from '../config/db.js';
import { ensureDatabaseSchema } from '../scripts/ensureSchema.js';
import { optimizeDatabaseIndexes } from '../scripts/optimizeIndexes.js';
import { config } from '../config/env.config.js';

/**
 * Centralized Database Bootstrap Orchestrator
 * Verifies connectivity, ensures schema integrity, and conditionally optimizes indexes.
 */
export const initDatabase = async () => {
  console.log('🔌 Initializing Database Connection & Schema...');
  
  // 1. Verify connection pool
  await testDbConnection();

  // 2. Ensure schema tables, columns, indexes, and initial admin exist
  await ensureDatabaseSchema();

  // 3. Optional optimization pass if requested by environment
  if (config.db.runSeed) {
    console.log('⚡ Running database index optimization...');
    await optimizeDatabaseIndexes();
  }

  console.log('✅ Database initialization complete.');
  return true;
};

export { ensureDatabaseSchema, optimizeDatabaseIndexes, testDbConnection };
export default initDatabase;
