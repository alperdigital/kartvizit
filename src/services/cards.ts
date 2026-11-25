import Dexie, { type Table } from 'dexie'
import type { Card } from './card-contract'
export * from './card-contract'

export const db = new Dexie('kartvizit')
db.version(1).stores({cards:'id, createdAt, company, isFavorite, *tags'})
export const cards: Table<Card,string> = db.table('cards')
