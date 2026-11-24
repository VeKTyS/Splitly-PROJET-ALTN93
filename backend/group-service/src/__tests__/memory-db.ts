import { openDatabase } from '../db/database';
import { SqlGroupRepository } from '../repositories/group.repository';

/** Repository SQL branche sur une base pg-mem neuve : chaque test part d'une base vide. */
export async function memoryRepository() {
  return new SqlGroupRepository(await openDatabase());
}
