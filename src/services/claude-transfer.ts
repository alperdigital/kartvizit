import { cardSchema, cards, duplicates, normalizePhone, type Card } from './cards'
import { backup, readBackup } from './export'

// Only structured contact data crosses the PWA/Artifact boundary.
export function portableCard(card:Card):Card {
  const result={...card,rawOcrText:'',ocrConfidence:null,fieldConfidence:{},
    phoneNumbers:card.phoneNumbers.map(p=>({...p,number:normalizePhone(p.number)}))}
  delete result.photos
  return cardSchema.parse(result)
}
export const claudeExport=(data:Card[])=>backup(data.map(portableCard))
export function parseClaudeTransfer(text:string):Card[] {
  if(new Blob([text]).size>50*1024*1024)throw new Error('Transfer too large')
  return readBackup(text).map(portableCard)
}
export async function importClaudeTransfer(incoming:Card[]) {
  const validated=parseClaudeTransfer(claudeExport(incoming))
  return cards.db.transaction('rw',cards,async()=>{
    const existing=await cards.toArray()
    const byId=new Map(existing.map(c=>[c.id,c]))
    let added=0, skipped=0, updated=0, conflicts=0
    for(const card of validated){
      const current=byId.get(card.id)
      if(current){
        // Keep local photos and OCR history; newer explicit edits win.
        if(Date.parse(card.updatedAt)>Date.parse(current.updatedAt)){
          const next={...current,...card,createdAt:current.createdAt,photos:current.photos,rawOcrText:current.rawOcrText,
            ocrConfidence:current.ocrConfidence,fieldConfidence:current.fieldConfidence}
          await cards.put(next)
          existing[existing.findIndex(c=>c.id===card.id)]=next
          byId.set(card.id,next)
          updated++
        }else if(Date.parse(card.updatedAt)===Date.parse(current.updatedAt)&&
          JSON.stringify(portableCard(current))!==JSON.stringify(card)) conflicts++
        else skipped++
      }else if(duplicates(card,existing).length) conflicts++
      else{
        await cards.add(card)
        existing.push(card)
        byId.set(card.id,card)
        added++
      }
    }
    return {added,updated,skipped,conflicts}
  })
}
