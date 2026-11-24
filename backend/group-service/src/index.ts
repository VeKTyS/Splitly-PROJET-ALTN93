import { createApp } from './app';
import { env } from './config/env';
import { openDatabase } from './db/database';
import { createInviteCodeGenerator } from './lib/invite-code';
import { SqlGroupRepository } from './repositories/group.repository';
import { GroupService } from './services/group.service';

async function main() {
  const db = await openDatabase(env.DATABASE_URL);
  // On n'affiche jamais DATABASE_URL : elle contient le mot de passe.
  console.log(`base de donnees : ${env.DATABASE_URL ? 'PostgreSQL' : 'en memoire (pg-mem)'}`);

  const service = new GroupService(new SqlGroupRepository(db), createInviteCodeGenerator());
  const server = createApp(service).listen(env.PORT, () => {
    console.log(`group-service ecoute sur le port ${env.PORT}`);
  });

  // Kubernetes envoie SIGTERM avant de tuer le pod : on finit les requetes en cours, on ferme la base, puis on sort.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`${signal} recu, arret du serveur`);
      server.close(() => {
        db.end().finally(() => process.exit(0));
      });
    });
  }
}

main().catch((err) => {
  // Base injoignable au demarrage : on s'arrete, Kubernetes redemarrera le pod.
  console.error('Demarrage impossible :', err instanceof Error ? err.message : err);
  process.exit(1);
});
