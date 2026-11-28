import { cards, type Card } from './cards'
import { backup, csv, readBackup, rows, vcard, type Format } from './file-contract'
export * from './file-contract'

export async function readRestoreFile(file:File) {
  if(file.size>50*1024*1024) throw new Error('Backup size')
  return readBackup(await file.text())
}

export async function restore(incoming:Card[]) {
  return cards.db.transaction('rw',cards,async()=>{
    const existing=await cards.bulkGet(incoming.map(c=>c.id))
    const fresh=incoming.filter((_,index)=>!existing[index])
    await cards.bulkAdd(fresh)
    return {added:fresh.length,skipped:incoming.length-fresh.length}
  })
}
export async function makeFile(data:Card[], format:Format) {
  const name='kartvizit-'+new Date().toISOString().slice(0,10)+'.'+format
  if(format==='xlsx'){
    const {default:write}=await import('write-excel-file/browser')
    const output=await write(rows(data).map(r=>r.map(value=>({value,type:String})))).toBlob()
    return new File([output],name,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
  }
  const [value,type]=format==='csv'?[csv(data),'text/csv']:format==='vcf'?[vcard(data),'text/vcard']:[backup(data),'application/json']
  return new File([value],name,{type})
}
