import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createInviteCodeGenerator } from '../lib/invite-code';
import { memoryRepository } from './memory-db';
import { GroupService } from '../services/group.service';

/**
 * Test d'integration HTTP : vraie app Express, vraies routes, base en memoire neuve a chaque test.
 * supertest envoie les requetes sans ouvrir de port reseau.
 */
describe('API /api/groups', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp(new GroupService(await memoryRepository(), createInviteCodeGenerator()));
  });

  async function createGroup(name: string, currency?: string) {
    const res = await request(app).post('/api/groups').send({ name, currency }).expect(201);
    return res.body as { id: number; inviteCode: string };
  }

  async function addParticipant(groupId: number, name: string) {
    const res = await request(app).post(`/api/groups/${groupId}/participants`).send({ name }).expect(201);
    return res.body as { id: number; name: string };
  }

  it('POST cree un groupe : 201, Location, EUR par defaut, code a 6 caracteres', async () => {
    const res = await request(app).post('/api/groups').send({ name: '  Week-end Lyon  ' });

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/groups/${res.body.id}`);
    expect(res.body).toMatchObject({ name: 'Week-end Lyon', currency: 'EUR', participants: [] });
    expect(res.body.inviteCode).toMatch(/^[A-Z2-9]{6}$/);
  });

  it.each([
    [{ name: '   ' }],
    [{}],
    [{ name: 'Coloc', currency: 'euro' }],
    [{ name: 'x'.repeat(101) }],
  ])('POST refuse un corps invalide avec 400 : %j', async (body) => {
    const res = await request(app).post('/api/groups').send(body);

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it('POST avec un JSON mal forme renvoie 400 et pas 500', async () => {
    await request(app).post('/api/groups').set('Content-Type', 'application/json').send('{"name":').expect(400);
  });

  it('il n existe pas de liste de tous les groupes : elle exposerait les codes d invitation', async () => {
    await createGroup('Secret');

    const res = await request(app).get('/api/groups');

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('Secret');
  });

  it('ajoute puis supprime des participants', async () => {
    const group = await createGroup('Ski');
    const alice = await addParticipant(group.id, 'Alice');
    await addParticipant(group.id, 'Bob');

    let res = await request(app).get(`/api/groups/${group.id}`).expect(200);
    expect(res.body.participants.map((p: { name: string }) => p.name)).toEqual(['Alice', 'Bob']);

    await request(app).delete(`/api/groups/${group.id}/participants/${alice.id}`).expect(204);

    res = await request(app).get(`/api/groups/${group.id}`).expect(200);
    expect(res.body.participants.map((p: { name: string }) => p.name)).toEqual(['Bob']);
  });

  it('supprimer un participant d un autre groupe renvoie 404', async () => {
    const a = await createGroup('A');
    const b = await createGroup('B');
    const alice = await addParticipant(a.id, 'Alice');

    await request(app).delete(`/api/groups/${b.id}/participants/${alice.id}`).expect(404);
  });

  it('groupe inexistant : 404 en GET comme en ajout de participant', async () => {
    const res = await request(app).get('/api/groups/999').expect(404);
    expect(res.body).toMatchObject({ status: 404, detail: 'Groupe 999 introuvable' });

    await request(app).post('/api/groups/999/participants').send({ name: 'Alice' }).expect(404);
  });

  it('un id non numerique renvoie 400', async () => {
    await request(app).get('/api/groups/abc').expect(400);
  });

  it('retrouve un groupe par code d invitation, meme saisi en minuscules', async () => {
    const group = await createGroup('Soiree', 'CHF');

    const res = await request(app).get(`/api/groups/invite/${group.inviteCode.toLowerCase()}`).expect(200);
    expect(res.body).toMatchObject({ id: group.id, currency: 'CHF' });

    const unknown = group.inviteCode === 'ZZZZZZ' ? 'YYYYYY' : 'ZZZZZZ';
    await request(app).get(`/api/groups/invite/${unknown}`).expect(404);
  });

  it('GET /health renvoie UP', async () => {
    await request(app).get('/health').expect(200, { status: 'UP' });
  });
});
