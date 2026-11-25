import type { Pool } from 'pg';

export interface Expense {
  id: number;
  groupId: number;
  label: string;
  amountCents: number;
  payerId: number;
  beneficiaryIds: number[];
  category: string;
  date: string; // AAAA-MM-JJ
  createdAt: string; // ISO 8601
}

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;

/** Contrat d'acces aux donnees : le service metier ne connait que cette interface, pas le SQL. */
export interface ExpenseRepository {
  create(expense: NewExpense): Promise<Expense>;
  /** Les plus recentes d'abord. */
  findByGroup(groupId: number): Promise<Expense[]>;
  /** false si la depense n'existe pas. */
  delete(id: number): Promise<boolean>;
}

interface ExpenseRow {
  id: number;
  group_id: number;
  label: string;
  amount_cents: number;
  payer_id: number;
  beneficiary_ids: number[];
  category: string;
  date: string | Date; // texte avec PostgreSQL, Date avec pg-mem
  created_at: Date;
}

export class SqlExpenseRepository implements ExpenseRepository {
  constructor(private readonly db: Pool) {}

  async create(e: NewExpense): Promise<Expense> {
    const { rows } = await this.db.query<ExpenseRow>(
      `INSERT INTO expense (group_id, label, amount_cents, payer_id, beneficiary_ids, category, date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [e.groupId, e.label, e.amountCents, e.payerId, e.beneficiaryIds, e.category, e.date, new Date()],
    );
    return toExpense(rows[0]);
  }

  async findByGroup(groupId: number): Promise<Expense[]> {
    const { rows } = await this.db.query<ExpenseRow>(
      'SELECT * FROM expense WHERE group_id = $1 ORDER BY date DESC, id DESC',
      [groupId],
    );
    return rows.map(toExpense);
  }

  async delete(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query('DELETE FROM expense WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    label: row.label,
    amountCents: row.amount_cents,
    payerId: row.payer_id,
    beneficiaryIds: [...row.beneficiary_ids],
    category: row.category,
    date: typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
    createdAt: new Date(row.created_at).toISOString(),
  };
}
