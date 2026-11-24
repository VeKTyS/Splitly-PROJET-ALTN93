import { describe, expect, it } from 'vitest';
import type { GroupDirectory } from '../clients/group-directory';
import { NotFoundError, RuleViolationError } from '../lib/errors';
import { memoryRepository } from './memory-db';
import { ExpenseService } from '../services/expense.service';

/** Faux group-service : le groupe 1 contient les participants 10, 11 et 12. */
const fakeGroups: GroupDirectory = {
  async getParticipantIds(groupId) {
    return groupId === 1 ? [10, 11, 12] : null;
  },
};

const hotel = {
  groupId: 1,
  label: 'Hotel',
  amountCents: 9000,
  payerId: 10,
  beneficiaryIds: [10, 11, 12],
  category: 'logement',
  date: '2026-11-20',
};

async function newService() {
  return new ExpenseService(await memoryRepository(), fakeGroups);
}

describe('ExpenseService', () => {
  it('enregistre une depense dont le payeur et les beneficiaires sont dans le groupe', async () => {
    const service = await newService();

    const created = await service.create(hotel);

    expect(created).toMatchObject({ id: 1, ...hotel });
  });

  it('RG3 : refuse un payeur qui ne fait pas partie du groupe', async () => {
    const service = await newService();

    await expect(service.create({ ...hotel, payerId: 99 })).rejects.toBeInstanceOf(RuleViolationError);
  });

  it('RG3 : refuse un beneficiaire hors du groupe, et le nomme dans le message', async () => {
    const service = await newService();

    await expect(service.create({ ...hotel, beneficiaryIds: [10, 98, 99] })).rejects.toThrow(
      'Beneficiaire(s) 98, 99 hors du groupe 1',
    );
  });

  it('groupe inexistant : NotFoundError, et rien n est enregistre', async () => {
    const service = await newService();

    await expect(service.create({ ...hotel, groupId: 2 })).rejects.toBeInstanceOf(NotFoundError);
    expect(await service.listByGroup(2)).toEqual([]);
  });

  it('liste les depenses d un groupe, les plus recentes d abord', async () => {
    const service = await newService();
    await service.create({ ...hotel, label: 'Vieux', date: '2026-11-01' });
    await service.create({ ...hotel, label: 'Recent', date: '2026-11-25' });

    const labels = (await service.listByGroup(1)).map((e) => e.label);

    expect(labels).toEqual(['Recent', 'Vieux']);
  });

  it('supprime une depense, puis 404 si on la supprime une seconde fois', async () => {
    const service = await newService();
    const created = await service.create(hotel);

    await service.delete(created.id);

    expect(await service.listByGroup(1)).toEqual([]);
    await expect(service.delete(created.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
