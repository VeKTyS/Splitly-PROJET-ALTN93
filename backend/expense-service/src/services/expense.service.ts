import type { GroupDirectory } from '../clients/group-directory';
import { NotFoundError, RuleViolationError } from '../lib/errors';
import type { Expense, ExpenseRepository, NewExpense } from '../repositories/expense.repository';

export class ExpenseService {
  constructor(
    private readonly repository: ExpenseRepository,
    private readonly groups: GroupDirectory,
  ) {}

  /** RG3 : le payeur et les beneficiaires doivent appartenir au groupe. On le demande a group-service. */
  async create(expense: NewExpense): Promise<Expense> {
    const participantIds = await this.groups.getParticipantIds(expense.groupId);
    if (participantIds === null) {
      throw new NotFoundError(`Groupe ${expense.groupId} introuvable`);
    }

    const members = new Set(participantIds);
    if (!members.has(expense.payerId)) {
      throw new RuleViolationError(`Le payeur ${expense.payerId} ne fait pas partie du groupe ${expense.groupId}`);
    }
    const outsiders = expense.beneficiaryIds.filter((id) => !members.has(id));
    if (outsiders.length > 0) {
      throw new RuleViolationError(
        `Beneficiaire(s) ${outsiders.join(', ')} hors du groupe ${expense.groupId}`,
      );
    }

    return this.repository.create(expense);
  }

  listByGroup(groupId: number): Promise<Expense[]> {
    return this.repository.findByGroup(groupId);
  }

  async delete(id: number): Promise<void> {
    if (!(await this.repository.delete(id))) {
      throw new NotFoundError(`Depense ${id} introuvable`);
    }
  }
}
