import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ExpenseService } from '../services/expense.service';

export const CATEGORIES = ['repas', 'courses', 'transport', 'logement', 'loisirs', 'autre'] as const;

const idSchema = z.coerce.number().int().positive();

const createExpenseSchema = z.object({
  groupId: z.number().int().positive(),
  label: z.string().trim().min(1).max(100),
  // RG1 : montant en centimes entiers. Plafond a 1 000 000 EUR pour bloquer les saisies absurdes.
  amountCents: z.number().int().positive().max(100_000_000),
  payerId: z.number().int().positive(),
  beneficiaryIds: z
    .array(z.number().int().positive())
    .min(1, 'au moins un beneficiaire')
    .refine((ids) => new Set(ids).size === ids.length, 'un beneficiaire apparait deux fois'),
  category: z.enum(CATEGORIES).default('autre'),
  date: z.iso.date(), // AAAA-MM-JJ
});

const listQuerySchema = z.object({ groupId: idSchema });

/**
 * Couche HTTP : valide les entrees, appelle le service, choisit le code de reponse.
 * Avec Express 5, une erreur levee dans un handler async remonte toute seule au middleware d'erreur.
 */
export function createExpenseController(service: ExpenseService) {
  return {
    async create(req: Request, res: Response) {
      const expense = await service.create(createExpenseSchema.parse(req.body));
      res.status(201).location(`/api/expenses/${expense.id}`).json(expense);
    },

    async list(req: Request, res: Response) {
      const { groupId } = listQuerySchema.parse(req.query);
      res.json(await service.listByGroup(groupId));
    },

    async remove(req: Request, res: Response) {
      await service.delete(idSchema.parse(req.params.id));
      res.status(204).end();
    },
  };
}
