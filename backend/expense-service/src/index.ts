import { createApp } from './app';
import { HttpGroupDirectory } from './clients/group-directory';
import { env } from './config/env';
import { openDatabase } from './db/database';
import { SqlExpenseRepository } from './repositories/expense.repository';
import { ExpenseService } from './services/expense.service';

async function main() {
  const db = await openDatabase(env.DATABASE_URL);
  // On n'affiche jamais DATABASE_URL : elle contient le mot de passe.
  console.log(`base de donnees : ${env.DATABASE_URL ? 'PostgreSQL' : 'en memoire (pg-mem)'}`);

  const service = new ExpenseService(new SqlExpenseRepository(db), new HttpGroupDirectory(env.GROUP_SERVICE_URL));
  const server = createApp(service).listen(env.PORT, () => {
    console.log(`expense-service ecoute sur le port ${env.PORT} (group-service : ${env.GROUP_SERVICE_URL})`);
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
