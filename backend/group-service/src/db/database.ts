import { Pool } from 'pg';
import { newDb } from 'pg-mem';

/** Tables de groups_db. "GROUP" etant un mot reserve en SQL, la table s'appelle split_group. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS split_group (
    id          serial PRIMARY KEY,
    name        varchar(100) NOT NULL,
    currency    varchar(3)   NOT NULL,
    invite_code varchar(6)   NOT NULL UNIQUE,
    created_at  timestamptz  NOT NULL
  );
  CREATE TABLE IF NOT EXISTS participant (
    id       serial PRIMARY KEY,
    group_id integer     NOT NULL REFERENCES split_group(id) ON DELETE CASCADE,
    name     varchar(50) NOT NULL
  );
`;

/**
 * Ouvre la base et cree les tables si besoin.
 * - DATABASE_URL defini : vrai PostgreSQL (Kubernetes).
 * - sinon : base PostgreSQL simulee en memoire (pg-mem), videe a chaque redemarrage. Sert au dev et aux tests.
 */
export async function openDatabase(databaseUrl?: string): Promise<Pool> {
  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : createMemoryPool();
  await pool.query(SCHEMA);
  return pool;
}

function createMemoryPool(): Pool {
  const { Pool: MemoryPool } = newDb().adapters.createPg();
  return new MemoryPool() as Pool;
}
