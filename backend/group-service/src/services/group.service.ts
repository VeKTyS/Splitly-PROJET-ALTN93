import { DuplicateInviteCodeError, NotFoundError } from '../lib/errors';
import type { InviteCodeGenerator } from '../lib/invite-code';
import type { Group, GroupRepository, Participant } from '../repositories/group.repository';

export const DEFAULT_CURRENCY = 'EUR';
const MAX_INVITE_CODE_ATTEMPTS = 10;

export class GroupService {
  constructor(
    private readonly repository: GroupRepository,
    private readonly nextInviteCode: InviteCodeGenerator,
  ) {}

  /**
   * On ne verifie pas "le code est-il libre ?" avant d'inserer : entre la verification et l'insertion,
   * une autre requete pourrait prendre le meme code. On tente l'insertion directement,
   * et c'est le repository qui refuse un doublon. En cas de refus, on retente avec un nouveau code.
   */
  async create(name: string, currency: string = DEFAULT_CURRENCY): Promise<Group> {
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.repository.create({
          name,
          currency,
          inviteCode: this.nextInviteCode(),
          createdAt: new Date(),
        });
      } catch (err) {
        if (!(err instanceof DuplicateInviteCodeError)) throw err;
      }
    }
    throw new Error("Impossible de generer un code d'invitation unique");
  }

  async get(groupId: number): Promise<Group> {
    const group = await this.repository.findById(groupId);
    if (!group) throw new NotFoundError(`Groupe ${groupId} introuvable`);
    return group;
  }

  async getByInviteCode(code: string): Promise<Group> {
    // Les codes sont generes en majuscules : on tolere une saisie en minuscules.
    const group = await this.repository.findByInviteCode(code.trim().toUpperCase());
    if (!group) throw new NotFoundError("Aucun groupe pour ce code d'invitation");
    return group;
  }

  async addParticipant(groupId: number, name: string): Promise<Participant> {
    await this.get(groupId); // 404 si le groupe n'existe pas
    return this.repository.addParticipant(groupId, name);
  }

  async removeParticipant(groupId: number, participantId: number): Promise<void> {
    await this.get(groupId);
    // RG4 (refus si le participant a des depenses) sera branchee quand expense-service existera.
    const removed = await this.repository.removeParticipant(groupId, participantId);
    if (!removed) {
      throw new NotFoundError(`Participant ${participantId} introuvable dans le groupe ${groupId}`);
    }
  }
}
