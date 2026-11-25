import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { GroupDirectory } from '../clients/group-directory';
import { GroupServiceUnavailableError } from '../lib/errors';
import { memoryRepository } from './memory-db';
import { ExpenseService } from '../services/expense.service';

/** Faux group-service : le groupe 1 contient les participants 10 et 11 ; le groupe 666 simule une panne. */
const fakeGroups: GroupDirectory = {
  async getParticipantIds(groupId) {
    if (groupId === 666) {
      throw new GroupServiceUnavailableError();
    }
    return groupId === 1 ? [10, 11] : null;
  },
};

const restaurant = {
  groupId: 1,
  label: 'Restaurant',
  amountCents: 4500,
  payerId: 11,
  beneficiaryIds: [10, 11],
  category: 'repas',
  date: '2026-11-20',
};

describe('API /api/expenses', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp(new ExpenseService(await memoryRepository(), fakeGroups));
  });

  it('POST cree une depense : 201 et en-tete Location', async () => {
    const res = await request(app).post('/api/expenses').send(restaurant);

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/expenses/${res.body.id}`);
    expect(res.body).toMatchObject(restaurant);
  });

  it('POST sans categorie : "autre" par defaut', async () => {
    const { category: _category, ...sansCategorie } = restaurant;

    const res = await request(app).post('/api/expenses').send(sansCategorie).expect(201);

    expect(res.body.category).toBe('autre');
  });

  it.each([
    ['montant a virgule (RG1 : centimes entiers)', { amountCents: 45.5 }],
    ['montant negatif', { amountCents: -100 }],
    ['aucun beneficiaire', { beneficiaryIds: [] }],
    ['beneficiaire en double', { beneficiaryIds: [10, 10] }],
    ['libelle vide', { label: '   ' }],
    ['date mal formee', { date: '20/11/2026' }],
    ['categorie inconnue', { category: 'casino' }],
  ])('POST refuse avec 400 : %s', async (_cas, override) => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...restaurant, ...override });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('RG3 : payeur hors du groupe -> 409', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...restaurant, payerId: 99 });

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('ne fait pas partie du groupe');
  });

  it('groupe inexistant -> 404', async () => {
    await request(app)
      .post('/api/expenses')
      .send({ ...restaurant, groupId: 2 })
      .expect(404);
  });

  it('group-service en panne -> 503, sans detail technique', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .send({ ...restaurant, groupId: 666 });

    expect(res.status).toBe(503);
    expect(res.body.detail).toBe('Impossible de verifier le groupe pour le moment');
  });

  it('GET liste les depenses du groupe demande, et exige groupId', async () => {
    await request(app).post('/api/expenses').send(restaurant).expect(201);

    const res = await request(app).get('/api/expenses?groupId=1').expect(200);
    expect(res.body).toHaveLength(1);

    await request(app).get('/api/expenses?groupId=2').expect(200, []);
    await request(app).get('/api/expenses').expect(400);
  });

  it('DELETE supprime : 204, puis 404', async () => {
    const created = await request(app).post('/api/expenses').send(restaurant).expect(201);

    await request(app).delete(`/api/expenses/${created.body.id}`).expect(204);
    await request(app).delete(`/api/expenses/${created.body.id}`).expect(404);
  });

  it('GET /health renvoie UP', async () => {
    await request(app).get('/health').expect(200, { status: 'UP' });
  });
});
