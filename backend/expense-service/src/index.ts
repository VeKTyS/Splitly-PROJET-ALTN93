import { createApp } from './app';
import { HttpGroupDirectory } from './clients/group-directory';
import { env } from './config/env';
import { InMemoryExpenseRepository } from './repositories/expense.repository';
import { ExpenseService } from './services/expense.service';

const service = new ExpenseService(new InMemoryExpenseRepository(), new HttpGroupDirectory(env.GROUP_SERVICE_URL));
const server = createApp(service).listen(env.PORT, () => {
  console.log(`expense-service ecoute sur le port ${env.PORT} (group-service : ${env.GROUP_SERVICE_URL})`);
});

// Kubernetes envoie SIGTERM avant de tuer le pod : on finit les requetes en cours puis on sort proprement.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} recu, arret du serveur`);
    server.close(() => process.exit(0));
  });
}
