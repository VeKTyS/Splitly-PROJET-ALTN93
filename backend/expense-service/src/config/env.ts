import { z } from 'zod';

const envSchema = z.object({
  // 8081 par defaut pour ne pas entrer en conflit avec group-service (8080) quand on lance les deux en local.
  PORT: z.coerce.number().int().min(1).max(65535).default(8081),
  // Adresse de group-service. Dans Kubernetes : http://group-service:8080 (le nom du Service).
  GROUP_SERVICE_URL: z.url().default('http://localhost:8080'),
});

/** Lu une seule fois au demarrage : une variable invalide fait planter le service tout de suite, pas en pleine requete. */
export const env = envSchema.parse(process.env);
