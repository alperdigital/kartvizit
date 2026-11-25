import {cards,type Card} from './cards'
import {claudeExport,parseClaudeTransfer,planTransfer,type TransferDecision} from './transfer-contract'
export * from './transfer-contract'

export async function importClaudeTransfer(incoming:Card[],decisions?:ReadonlyMap<string,TransferDecision>,invalid=0) {
  const validated=parseClaudeTransfer(claudeExport(incoming))
  return cards.db.transaction('rw',cards,async()=>{
    const plan=planTransfer({cards:validated,invalid},await cards.toArray(),decisions)
    // With reviewed imports, do not write a partial batch if the preview became stale.
    if(decisions && plan.conflicts.length)throw new Error('Transfer preview is stale')
    if(plan.changes.length)await cards.bulkPut(plan.changes)
    return plan.report
  })
}
