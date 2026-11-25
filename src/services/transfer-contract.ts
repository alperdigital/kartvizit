import { cardSchema, duplicates, fold, normalizePhone, type Card } from './card-contract'
import { backup, readBackup } from './file-contract'

export const transferLimit=50*1024*1024
const scalarFields=['firstName','lastName','fullName','company','department','jobTitle','notes'] as const
const listFields=['phoneNumbers','emailAddresses','websites','socialLinks','addresses','tags'] as const
export type TransferChoice='keep'|'incoming'|'merge'|'separate'|'skip'
export type TransferDecision={choice:TransferChoice;targetId:string;targetState:string;separateId?:string}
export type TransferReport={total:number;added:number;updated:number;skipped:number;duplicates:number;conflicts:number;invalid:number}
export type TransferConflict={incoming:Card;existing:Card[];reason:'newer'|'older'|'sameTime'|'similar'}
export type TransferInput={cards:Card[];invalid:number}

export function portableCard(card:Card):Card {
  const result={...card,rawOcrText:'',ocrConfidence:null,fieldConfidence:{},
    phoneNumbers:card.phoneNumbers.map(p=>({...p,number:normalizePhone(p.number)}))}
  delete result.photos
  return cardSchema.parse(result)
}
export const claudeExport=(data:Card[])=>backup(data.map(portableCard))
export function parseClaudeTransfer(text:string):Card[] {
  if(new Blob([text]).size>transferLimit)throw new Error('Transfer too large')
  return readBackup(text.replace(/^\uFEFF/,'')).map(portableCard)
}
export function inspectTransfer(text:string):TransferInput {
  if(new Blob([text]).size>transferLimit)throw new Error('Transfer too large')
  const data:unknown=JSON.parse(text.replace(/^\uFEFF/,''))
  if(!data || typeof data!=='object' || !('format' in data) || data.format!=='kartvizit' ||
    !('version' in data) || data.version!==1 || !('cards' in data) ||
    !Array.isArray(data.cards) || data.cards.length>25000)throw new Error('Invalid transfer envelope')
  const result:TransferInput={cards:[],invalid:0}
  const seen=new Set<string>()
  for(const raw of data.cards as unknown[]){
    if(!raw || typeof raw!=='object'){result.invalid++;continue}
    // The portable boundary drops private payloads before validating contact fields.
    const parsed=cardSchema.omit({photos:true}).safeParse({...raw,rawOcrText:'',ocrConfidence:null,fieldConfidence:{}})
    if(!parsed.success || seen.has(parsed.data.id)){result.invalid++;continue}
    seen.add(parsed.data.id)
    result.cards.push(portableCard(parsed.data))
  }
  return result
}

export const transferState=(card:Card)=>JSON.stringify(portableCard(card))
function sameContent(a:Card,b:Card){
  const left=portableCard(a),right=portableCard(b)
  return JSON.stringify({...left,id:'',createdAt:'',updatedAt:''})===JSON.stringify({...right,id:'',createdAt:'',updatedAt:''})
}
const versionTime=(c:Card)=>Date.parse(c.updatedAt)
function replace(current:Card,incoming:Card,merge:boolean):Card {
  const next:Card={...current,...incoming,id:current.id,createdAt:current.createdAt,
    photos:current.photos,rawOcrText:current.rawOcrText,ocrConfidence:current.ocrConfidence,fieldConfidence:current.fieldConfidence}
  for(const key of scalarFields) if(!incoming[key].trim())next[key]=current[key]
  for(const key of listFields){
    const values=incoming[key]
    if(merge || !values.length){
      const union=[...new Map([...values,...current[key]].map(value=>[JSON.stringify(value),value])).values()].slice(0,100)
      Object.assign(next,{[key]:union})
    }
  }
  if(merge){
    next.notes=[...new Set([current.notes,incoming.notes].filter(Boolean))].join('\n').slice(0,30000)
    next.isFavorite=current.isFavorite||incoming.isFavorite
    next.needsReview=current.needsReview||incoming.needsReview
  }
  // Keep incoming timestamp on newer same-ID versions so repeated files are idempotent.
  if(merge || current.id!==incoming.id || versionTime(current)>=versionTime(incoming))
    next.updatedAt=new Date(Math.max(Date.now(),versionTime(current)+1,versionTime(incoming)+1)).toISOString()
  return cardSchema.parse(next)
}

export function planTransfer(input:TransferInput,archive:Card[],decisions?:ReadonlyMap<string,TransferDecision>){
  const byId=new Map(archive.map(card=>[card.id,card]))
  const index=new Map<string,Set<string>>()
  const keys=(card:Card)=>[
    ...card.emailAddresses.map(email=>email.trim().toLowerCase()).filter(Boolean).map(email=>'e:'+email),
    ...card.phoneNumbers.map(phone=>normalizePhone(phone.number)).filter(phone=>phone.length>=7).map(phone=>'p:'+phone),
    ...(card.company.trim()?['c:'+fold(card.company)]:[]),
  ]
  function indexCard(card:Card){
    for(const key of keys(card)){
      const ids=index.get(key)??new Set<string>()
      ids.add(card.id);index.set(key,ids)
    }
  }
  for(const card of archive)indexCard(card)
  function candidates(card:Card){
    const ids=new Set(keys(card).flatMap(key=>[...(index.get(key)??[])]))
    return duplicates(card,[...ids].map(id=>byId.get(id)!))
  }
  const changes:Card[]=[], conflicts:TransferConflict[]=[]
  const report:TransferReport={total:input.cards.length+input.invalid,added:0,updated:0,skipped:0,duplicates:0,conflicts:0,invalid:input.invalid}
  const add=(c:Card)=>{byId.set(c.id,c);indexCard(c);changes.push(c);report.added++}
  const update=(c:Card)=>{byId.set(c.id,c);indexCard(c);changes.push(c);report.updated++}
  for(const incoming of input.cards){
    const current=byId.get(incoming.id)
    if(current && (sameContent(current,incoming) || versionTime(current)===versionTime(incoming) &&
      sameContent(current,replace(current,incoming,false)))){
      report.duplicates++;report.skipped++;continue
    }
    const related=candidates(incoming)
    const similar=current?[current]:related
    if(related.some(card=>sameContent(card,incoming))){report.duplicates++;report.skipped++;if(!decisions)report.conflicts++;continue}
    if(!similar.length){add(incoming);continue}
    const difference=current?versionTime(incoming)-versionTime(current):0
    const reason=!current?'similar':difference>0?'newer':difference<0?'older':'sameTime'
    if(!decisions && reason==='newer'){update(replace(current!,incoming,false));continue}
    if(!decisions && reason==='older'){report.skipped++;continue}
    const decision=decisions?.get(incoming.id)
    const target=decision && similar.find(card=>card.id===decision.targetId && transferState(card)===decision.targetState)
    if(!decision || !target){conflicts.push({incoming,existing:similar,reason});report.conflicts++;continue}
    if(decision.choice==='separate'){
      add({...incoming,id:decision.separateId??crypto.randomUUID()})
    }else if(decision.choice==='incoming'||decision.choice==='merge'){
      update(replace(target,incoming,decision.choice==='merge'))
    }else report.skipped++
    report.conflicts++
  }
  return {changes,conflicts,report}
}

