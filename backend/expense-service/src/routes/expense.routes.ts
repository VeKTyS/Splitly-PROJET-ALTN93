import { Router } from 'express';
import { createExpenseController } from '../controllers/expense.controller';
import type { ExpenseService } from '../services/expense.service';

export function createExpenseRouter(service: ExpenseService): Router {
  const controller = createExpenseController(service);
  const router = Router();

  router.post('/', controller.create);
  router.get('/', controller.list); // ?groupId= obligatoire
  router.delete('/:id', controller.remove);

  return router;
}
