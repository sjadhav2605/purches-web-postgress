import pool from '../config/db.js';

export async function renameDirectors() {
  console.log('--- Updating Director names in Database ---');

  // 1. Update users table
  await pool.query(`UPDATE users SET name = 'Director 1', email = 'director1@ddpl.com' WHERE id = 5 OR email IN ('director@ddpl.com', 'director1@ddpl.com')`);
  await pool.query(`UPDATE users SET name = 'Director 2', email = 'director2@ddpl.com' WHERE id = 10 OR email IN ('director.patil@ddpl.com', 'director2@ddpl.com')`);
  await pool.query(`UPDATE users SET name = 'Director 3', email = 'director3@ddpl.com' WHERE id = 11 OR email IN ('director.deshmukh@ddpl.com', 'director3@ddpl.com')`);

  // 2. Update rfqs table
  await pool.query(`UPDATE rfqs SET target_director_name = 'Director 1' WHERE target_director_id = 5 OR target_director_name LIKE '%Sharma%'`);
  await pool.query(`UPDATE rfqs SET target_director_name = 'Director 2' WHERE target_director_id = 10 OR target_director_name LIKE '%Patil%'`);
  await pool.query(`UPDATE rfqs SET target_director_name = 'Director 3' WHERE target_director_id = 11 OR target_director_name LIKE '%Deshmukh%'`);

  // 3. Update requisitions table
  await pool.query(`UPDATE requisitions SET target_director_name = 'Director 1' WHERE target_director_id = 5 OR target_director_name LIKE '%Sharma%'`);
  await pool.query(`UPDATE requisitions SET target_director_name = 'Director 2' WHERE target_director_id = 10 OR target_director_name LIKE '%Patil%'`);
  await pool.query(`UPDATE requisitions SET target_director_name = 'Director 3' WHERE target_director_id = 11 OR target_director_name LIKE '%Deshmukh%'`);

  await pool.query(`UPDATE requisitions SET approved_by = 'Director 1' WHERE approved_by LIKE '%Sharma%'`);
  await pool.query(`UPDATE requisitions SET approved_by = 'Director 2' WHERE approved_by LIKE '%Patil%'`);
  await pool.query(`UPDATE requisitions SET approved_by = 'Director 3' WHERE approved_by LIKE '%Deshmukh%'`);

  // 4. Update audit_logs table
  await pool.query(`UPDATE audit_logs SET actor_name = 'Director 1' WHERE actor_name LIKE '%Sharma%'`);
  await pool.query(`UPDATE audit_logs SET actor_name = 'Director 2' WHERE actor_name LIKE '%Patil%'`);
  await pool.query(`UPDATE audit_logs SET actor_name = 'Director 3' WHERE actor_name LIKE '%Deshmukh%'`);

  await pool.query(`UPDATE audit_logs SET note = REPLACE(note, 'Director Sharma', 'Director 1') WHERE note LIKE '%Sharma%'`);
  await pool.query(`UPDATE audit_logs SET note = REPLACE(note, 'Director Patil', 'Director 2') WHERE note LIKE '%Patil%'`);
  await pool.query(`UPDATE audit_logs SET note = REPLACE(note, 'Director Deshmukh', 'Director 3') WHERE note LIKE '%Deshmukh%'`);

  // 5. Update status_history table
  await pool.query(`UPDATE status_history SET action_by = 'Director 1' WHERE action_by LIKE '%Sharma%'`);
  await pool.query(`UPDATE status_history SET action_by = 'Director 2' WHERE action_by LIKE '%Patil%'`);
  await pool.query(`UPDATE status_history SET action_by = 'Director 3' WHERE action_by LIKE '%Deshmukh%'`);

  await pool.query(`UPDATE status_history SET remark = REPLACE(remark, 'Director Sharma', 'Director 1') WHERE remark LIKE '%Sharma%'`);
  await pool.query(`UPDATE status_history SET remark = REPLACE(remark, 'Director Patil', 'Director 2') WHERE remark LIKE '%Patil%'`);
  await pool.query(`UPDATE status_history SET remark = REPLACE(remark, 'Director Deshmukh', 'Director 3') WHERE remark LIKE '%Deshmukh%'`);

  // 6. Update notifications table
  await pool.query(`UPDATE notifications SET message = REPLACE(message, 'Director Sharma', 'Director 1') WHERE message LIKE '%Sharma%'`);
  await pool.query(`UPDATE notifications SET message = REPLACE(message, 'Director Patil', 'Director 2') WHERE message LIKE '%Patil%'`);
  await pool.query(`UPDATE notifications SET message = REPLACE(message, 'Director Deshmukh', 'Director 3') WHERE message LIKE '%Deshmukh%'`);

  console.log('✅ All database records updated to Director 1, Director 2, Director 3!');
}

renameDirectors().then(() => process.exit(0)).catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
