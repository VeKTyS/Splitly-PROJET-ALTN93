import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { NotFoundError } from './lib/errors';
import { createGroupRouter } from './routes/group.routes';
import type { GroupService } from './services/group.service';

/**
 * Construit l'app sans demarrer le serveur : les tests l'appellent avec leurs propres dependances,
 * index.ts l'appelle avec les vraies.
 */
export function createApp(groupService: GroupService) {
  const app = express();
  app.disable('x-powered-by'); // ne pas annoncer la techno utilisee
  app.use(express.json({ limit: '10kb' }));

  // Sonde pour Kubernetes (readiness/liveness).
  app.get('/health', (_req, res) => {
    res.json({ status: 'UP' });
  });

  app.use('/api/groups', createGroupRouter(groupService));

  app.use((req, res) => {
    sendProblem(res, 404, 'Not Found', `Route ${req.method} ${req.path} inconnue`);
  });

  app.use(errorHandler);
  return app;
}

/** Erreurs au format RFC 9457 (application/problem+json). */
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    sendProblem(res, 400, 'Bad Request', 'Requete invalide', {
      errors: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }
  if (err instanceof NotFoundError) {
    sendProblem(res, 404, 'Not Found', err.message);
    return;
  }
  // JSON mal forme dans le corps : erreur du client, pas du serveur.
  if (err?.type === 'entity.parse.failed') {
    sendProblem(res, 400, 'Bad Request', 'Corps JSON invalide');
    return;
  }
  if (err?.type === 'entity.too.large') {
    sendProblem(res, 413, 'Payload Too Large', 'Corps de requete trop volumineux');
    return;
  }
  // Erreur inattendue : on la logge, mais on ne renvoie jamais le detail (stack, message interne) au client.
  console.error(err);
  sendProblem(res, 500, 'Internal Server Error', 'Erreur interne');
};

function sendProblem(
  res: express.Response,
  status: number,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  res
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status, detail, ...extra });
}
