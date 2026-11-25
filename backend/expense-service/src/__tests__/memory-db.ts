import { openDatabase } from '../db/database';
import { SqlExpenseRepository } from '../repositories/expense.repository';

/** Repository SQL branche sur une base pg-mem neuve : chaque test part d'une base vide. */
export async function memoryRepository() {
  return new SqlExpenseRepository(await openDatabase());
}
