import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  // Absent : base en memoire. Present (Kubernetes) : postgres://utilisateur:motdepasse@hote:5432/groups_db
  DATABASE_URL: z.string().min(1).optional(),
});

/** Lu une seule fois au demarrage : une variable invalide fait planter le service tout de suite, pas en pleine requete. */
export const env = envSchema.parse(process.env);
