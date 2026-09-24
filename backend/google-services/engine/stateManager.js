/**
 * State Manager for Google Services Engine
 * Persists bootstrap state to PostgreSQL database (google_services_state table) or in-memory fallback.
 */

const db = require('../../db/postgres');

let memoryState = {
  version: 1,
  completed: false,
  projectId: process.env.FIREBASE_PROJECT_ID || 'linkai-3eda1',
  services: {},
  errors: [],
  timestamp: new Date().toISOString()
};

async function getState() {
  try {
    const res = await db.query('SELECT * FROM google_services_state WHERE id = $1', ['current']);
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        version: row.bootstrap_version,
        completed: row.completed,
        projectId: row.project_id,
        services: row.services || {},
        errors: row.errors || [],
        timestamp: row.updated_at
      };
    }
  } catch (err) {
    // Database query failed or table not migrated yet, return memoryState
  }
  return memoryState;
}

async function saveState(state) {
  memoryState = {
    ...memoryState,
    ...state,
    timestamp: new Date().toISOString()
  };

  try {
    await db.query(`
      INSERT INTO google_services_state (id, bootstrap_version, completed, project_id, services, errors, updated_at)
      VALUES ('current', $1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        bootstrap_version = EXCLUDED.bootstrap_version,
        completed = EXCLUDED.completed,
        project_id = EXCLUDED.project_id,
        services = EXCLUDED.services,
        errors = EXCLUDED.errors,
        updated_at = CURRENT_TIMESTAMP
    `, [
      memoryState.version,
      memoryState.completed,
      memoryState.projectId,
      JSON.stringify(memoryState.services),
      JSON.stringify(memoryState.errors)
    ]);
  } catch (err) {
    // PostgreSQL error ignored, in-memory state preserved
  }

  return memoryState;
}

module.exports = {
  getState,
  saveState
};
