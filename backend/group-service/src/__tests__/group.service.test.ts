import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../lib/errors';
import { InMemoryGroupRepository } from '../repositories/group.repository';
import { GroupService } from '../services/group.service';

/** Generateur qui rejoue une liste de codes, pour provoquer des collisions a volonte. */
function sequence(...codes: string[]) {
  let i = 0;
  return () => codes[Math.min(i++, codes.length - 1)];
}

describe('GroupService', () => {
  it('regenere le code d invitation tant qu il est deja pris', async () => {
    const service = new GroupService(new InMemoryGroupRepository(), sequence('AAAAAA', 'AAAAAA', 'BBBBBB'));

    const first = await service.create('Premier');
    const second = await service.create('Second');

    expect(first.inviteCode).toBe('AAAAAA');
    expect(second.inviteCode).toBe('BBBBBB');
  });

  it('deux creations simultanees qui tirent le meme code obtiennent quand meme deux codes differents', async () => {
    const service = new GroupService(new InMemoryGroupRepository(), sequence('AAAAAA', 'AAAAAA', 'BBBBBB'));

    // Promise.all lance les deux creations sans attendre que la premiere soit finie.
    const [a, b] = await Promise.all([service.create('A'), service.create('B')]);

    expect(a.inviteCode).not.toBe(b.inviteCode);
    expect(new Set([a.inviteCode, b.inviteCode])).toEqual(new Set(['AAAAAA', 'BBBBBB']));
  });

  it('abandonne apres 10 collisions au lieu de boucler sans fin', async () => {
    const service = new GroupService(new InMemoryGroupRepository(), () => 'AAAAAA');
    await service.create('Premier');

    await expect(service.create('Second')).rejects.toThrow("code d'invitation unique");
  });

  it('les objets renvoyes sont des copies : les modifier ne change pas la donnee stockee', async () => {
    const service = new GroupService(new InMemoryGroupRepository(), sequence('AAAAAA'));
    const created = await service.create('Coloc');

    created.name = 'Pirate';
    created.participants.push({ id: 99, name: 'Intrus' });

    const reloaded = await service.get(created.id);
    expect(reloaded.name).toBe('Coloc');
    expect(reloaded.participants).toEqual([]);
  });

  it('refuse de supprimer un participant qui appartient a un autre groupe', async () => {
    const service = new GroupService(new InMemoryGroupRepository(), sequence('AAAAAA', 'BBBBBB'));
    const a = await service.create('A');
    const b = await service.create('B');
    const alice = await service.addParticipant(a.id, 'Alice');

    await expect(service.removeParticipant(b.id, alice.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await service.get(a.id)).participants).toHaveLength(1);
  });
});
