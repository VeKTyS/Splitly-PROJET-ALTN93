import { Pool, types } from 'pg';
import { newDb } from 'pg-mem';

/**
 * Table de expenses_db.
 * group_id, payer_id et beneficiary_ids ne sont pas des cles etrangeres : ces ids vivent dans groups_db,
 * la base de group-service (une base par service).
 * Les beneficiaires sont stockes dans la ligne (tableau d'entiers) : une depense s'ecrit en une seule
 * instruction, donc sans transaction.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS expense (
    id              serial PRIMARY KEY,
    group_id        integer      NOT NULL,
    label           varchar(100) NOT NULL,
    amount_cents    integer      NOT NULL CHECK (amount_cents > 0),
    payer_id        integer      NOT NULL,
    beneficiary_ids integer[]    NOT NULL,
    category        varchar(20)  NOT NULL,
    date            date         NOT NULL,
    created_at      timestamptz  NOT NULL
  );
  CREATE INDEX IF NOT EXISTS expense_group_id_idx ON expense (group_id);
`;

/** OID PostgreSQL du type "date". */
const DATE_OID = 1082;

/**
 * Ouvre la base et cree la table si besoin.
 * - DATABASE_URL defini : vrai PostgreSQL (Kubernetes).
 * - sinon : base PostgreSQL simulee en memoire (pg-mem), videe a chaque redemarrage. Sert au dev et aux tests.
 */
export async function openDatabase(databaseUrl?: string): Promise<Pool> {
  let pool: Pool;
  if (databaseUrl) {
    // Par defaut, pg convertit une "date" en objet Date a minuit HEURE LOCALE : a Paris, le 20/11 deviendrait
    // le 19/11 a 23h en UTC. On garde donc la date telle quelle, en texte AAAA-MM-JJ.
    types.setTypeParser(DATE_OID, (value: string) => value);
    pool = new Pool({ connectionString: databaseUrl });
  } else {
    const { Pool: MemoryPool } = newDb().adapters.createPg();
    pool = new MemoryPool() as Pool;
  }
  await pool.query(SCHEMA);
  return pool;
}
