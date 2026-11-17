import { createApp } from './app';
import { env } from './config/env';
import { createInviteCodeGenerator } from './lib/invite-code';
import { InMemoryGroupRepository } from './repositories/group.repository';
import { GroupService } from './services/group.service';

const service = new GroupService(new InMemoryGroupRepository(), createInviteCodeGenerator());
const server = createApp(service).listen(env.PORT, () => {
  console.log(`group-service ecoute sur le port ${env.PORT}`);
});

// Kubernetes envoie SIGTERM avant de tuer le pod : on finit les requetes en cours puis on sort proprement.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} recu, arret du serveur`);
    server.close(() => process.exit(0));
  });
}
