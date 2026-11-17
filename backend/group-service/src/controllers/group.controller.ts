import type { Request, Response } from 'express';
import { z } from 'zod';
import type { GroupService } from '../services/group.service';

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/, 'doit etre un code ISO 4217, par exemple EUR')
    .optional(),
});

const addParticipantSchema = z.object({
  name: z.string().trim().min(1).max(50),
});

const idSchema = z.coerce.number().int().positive();

/**
 * Couche HTTP : valide les entrees, appelle le service, choisit le code de reponse.
 * Avec Express 5, une erreur levee dans un handler async remonte toute seule au middleware d'erreur.
 */
export function createGroupController(service: GroupService) {
  return {
    async create(req: Request, res: Response) {
      const body = createGroupSchema.parse(req.body);
      const group = await service.create(body.name, body.currency);
      res.status(201).location(`/api/groups/${group.id}`).json(group);
    },

    async get(req: Request, res: Response) {
      res.json(await service.get(idSchema.parse(req.params.id)));
    },

    async getByInviteCode(req: Request, res: Response) {
      res.json(await service.getByInviteCode(String(req.params.code)));
    },

    async addParticipant(req: Request, res: Response) {
      const body = addParticipantSchema.parse(req.body);
      const participant = await service.addParticipant(idSchema.parse(req.params.id), body.name);
      res.status(201).json(participant);
    },

    async removeParticipant(req: Request, res: Response) {
      await service.removeParticipant(idSchema.parse(req.params.id), idSchema.parse(req.params.pid));
      res.status(204).end();
    },
  };
}
