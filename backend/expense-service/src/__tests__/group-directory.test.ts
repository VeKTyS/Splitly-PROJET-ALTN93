import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpGroupDirectory } from '../clients/group-directory';
import { GroupServiceUnavailableError } from '../lib/errors';

/**
 * Test d'integration du lien entre services : un vrai serveur HTTP local joue group-service,
 * et HttpGroupDirectory l'appelle avec le vrai fetch. Les reponses imitent celles de group-service.
 */
describe('HttpGroupDirectory', () => {
  let server: Server;
  let baseUrl: string;
  const requestedUrls: string[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      requestedUrls.push(req.url ?? '');
      if (req.url === '/api/groups/1') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            id: 1,
            name: 'Lyon',
            participants: [
              { id: 10, name: 'Alice' },
              { id: 11, name: 'Bob' },
            ],
          }),
        );
      } else if (req.url === '/api/groups/500') {
        res.writeHead(500).end();
      } else {
        res.writeHead(404, { 'Content-Type': 'application/problem+json' }).end('{"status":404}');
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  it('appelle GET /api/groups/{id} et renvoie les ids des participants', async () => {
    const ids = await new HttpGroupDirectory(baseUrl).getParticipantIds(1);

    expect(ids).toEqual([10, 11]);
    expect(requestedUrls).toContain('/api/groups/1');
  });

  it('renvoie null quand group-service repond 404 (groupe inexistant)', async () => {
    expect(await new HttpGroupDirectory(baseUrl).getParticipantIds(2)).toBeNull();
  });

  it('group-service en erreur 500 -> GroupServiceUnavailableError', async () => {
    await expect(new HttpGroupDirectory(baseUrl).getParticipantIds(500)).rejects.toBeInstanceOf(
      GroupServiceUnavailableError,
    );
  });

  it('group-service injoignable -> GroupServiceUnavailableError', async () => {
    // Port 1 : rien n'ecoute, la connexion est refusee.
    await expect(new HttpGroupDirectory('http://127.0.0.1:1').getParticipantIds(1)).rejects.toBeInstanceOf(
      GroupServiceUnavailableError,
    );
  });
});
