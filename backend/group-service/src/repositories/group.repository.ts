import { DuplicateInviteCodeError } from '../lib/errors';

export interface Participant {
  id: number;
  name: string;
}

export interface Group {
  id: number;
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: string; // ISO 8601
  participants: Participant[];
}

export interface NewGroup {
  name: string;
  currency: string;
  inviteCode: string;
  createdAt: Date;
}

/**
 * Contrat d'acces aux donnees. Tout est async des maintenant :
 * l'implementation PostgreSQL de l'etape 4 pourra remplacer celle en memoire sans toucher au service.
 */
export interface GroupRepository {
  /**
   * Verifie l'unicite du code d'invitation ET insere, en une seule operation atomique.
   * Rejette avec DuplicateInviteCodeError si le code est deja pris.
   */
  create(group: NewGroup): Promise<Group>;
  findById(id: number): Promise<Group | null>;
  findByInviteCode(code: string): Promise<Group | null>;
  addParticipant(groupId: number, name: string): Promise<Participant>;
  /** false si le participant n'existe pas dans CE groupe. */
  removeParticipant(groupId: number, participantId: number): Promise<boolean>;
}

/**
 * Base "in memory" de l'etape 1 (demandee par le sujet avant PostgreSQL).
 * Renvoie toujours des copies : comme une vraie base, modifier un objet lu ne modifie pas la donnee stockee.
 */
export class InMemoryGroupRepository implements GroupRepository {
  private readonly groups = new Map<number, Group>();
  private nextGroupId = 1;
  private nextParticipantId = 1;

  async create(data: NewGroup): Promise<Group> {
    // Aucun await entre la verification et l'insertion : Node execute ce bloc d'un seul tenant,
    // aucune autre requete ne peut s'intercaler. C'est ce qui rend l'operation atomique.
    if (this.findGroupByInviteCode(data.inviteCode)) {
      throw new DuplicateInviteCodeError(data.inviteCode);
    }
    const group: Group = {
      id: this.nextGroupId++,
      name: data.name,
      currency: data.currency,
      inviteCode: data.inviteCode,
      createdAt: data.createdAt.toISOString(),
      participants: [],
    };
    this.groups.set(group.id, group);
    return structuredClone(group);
  }

  async findById(id: number): Promise<Group | null> {
    const group = this.groups.get(id);
    return group ? structuredClone(group) : null;
  }

  async findByInviteCode(code: string): Promise<Group | null> {
    const group = this.findGroupByInviteCode(code);
    return group ? structuredClone(group) : null;
  }

  /** Version synchrone, utilisable dans create() sans casser l'atomicite. */
  private findGroupByInviteCode(code: string): Group | undefined {
    for (const group of this.groups.values()) {
      if (group.inviteCode === code) return group;
    }
    return undefined;
  }

  async addParticipant(groupId: number, name: string): Promise<Participant> {
    const group = this.groups.get(groupId);
    if (!group) throw new Error(`Groupe ${groupId} absent du repository`);
    const participant: Participant = { id: this.nextParticipantId++, name };
    group.participants.push(participant);
    return { ...participant };
  }

  async removeParticipant(groupId: number, participantId: number): Promise<boolean> {
    const group = this.groups.get(groupId);
    if (!group) return false;
    const index = group.participants.findIndex((p) => p.id === participantId);
    if (index === -1) return false;
    group.participants.splice(index, 1);
    return true;
  }
}
