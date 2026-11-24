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

/** Contrat d'acces aux donnees, async pour que PostgreSQL puisse remplacer la memoire a l'etape 4. */
export interface ExpenseRepository {
  create(expense: NewExpense): Promise<Expense>;
  /** Les plus recentes d'abord. */
  findByGroup(groupId: number): Promise<Expense[]>;
  /** false si la depense n'existe pas. */
  delete(id: number): Promise<boolean>;
}

/** Base "in memory" : renvoie toujours des copies, comme une vraie base. */
export class InMemoryExpenseRepository implements ExpenseRepository {
  private readonly expenses = new Map<number, Expense>();
  private nextId = 1;

  async create(data: NewExpense): Promise<Expense> {
    const expense: Expense = { ...data, id: this.nextId++, createdAt: new Date().toISOString() };
    this.expenses.set(expense.id, expense);
    return structuredClone(expense);
  }

  async findByGroup(groupId: number): Promise<Expense[]> {
    return [...this.expenses.values()]
      .filter((e) => e.groupId === groupId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map((e) => structuredClone(e));
  }

  async delete(id: number): Promise<boolean> {
    return this.expenses.delete(id);
  }
}
