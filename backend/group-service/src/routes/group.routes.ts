import { Router } from 'express';
import { createGroupController } from '../controllers/group.controller';
import type { GroupService } from '../services/group.service';

export function createGroupRouter(service: GroupService): Router {
  const controller = createGroupController(service);
  const router = Router();

  // Pas de GET '/' : sans comptes, lister tous les groupes exposerait tous les codes d'invitation.
  router.post('/', controller.create);
  // Declaree avant /:id pour que "invite" ne soit jamais lu comme un id.
  router.get('/invite/:code', controller.getByInviteCode);
  router.get('/:id', controller.get);
  router.post('/:id/participants', controller.addParticipant);
  router.delete('/:id/participants/:pid', controller.removeParticipant);

  return router;
}
