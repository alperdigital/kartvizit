import {z} from 'zod'
import { cardSchema, labelOf, type Card } from './card-contract'
export type Format='csv'|'xlsx'|'vcf'|'json'
const headers=['Ad / First name','Soyad / Last name','Tam ad / Full name','Şirket / Company','Departman / Department','Unvan / Title','Telefon / Phone','E-posta / Email','Web','Adres / Address','Sosyal medya / Social','Notlar / Notes','Etiketler / Tags']
export const addressText=(a:Card['addresses'][number])=>Object.values(a).filter(Boolean).join(', ')
const cells=(c:Card)=>[c.firstName,c.lastName,labelOf(c),c.company,c.department,c.jobTitle,c.phoneNumbers.map(p=>p.number+' ('+p.kind+')').join(' / '),c.emailAddresses.join(' / '),c.websites.join(' / '),c.addresses.map(addressText).join(' / '),c.socialLinks.join(' / '),c.notes,c.tags.join(' / ')]
export const formulaSafe=(s:string)=>/^[\s\u200b\ufeff]*[=+@-]|^[\t\r\n]/.test(s)?"'"+s:s
export const rows=(data:Card[])=>[headers,...data.map(c=>cells(c).map(formulaSafe))]
export const csv=(data:Card[])=>'\uFEFF'+rows(data).map(r=>r.map(s=>'"'+s.replaceAll('"','""')+'"').join(',')).join('\r\n')
export const clipboardTable=(data:Card[])=>rows(data).map(r=>r.map(s=>s.replace(/[\t\r\n]+/g,' ')).join('\t')).join('\n')
const esc=(s:string)=>s.replaceAll('\\','\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/[;,]/g,'\\$&')
function foldLine(line:string) {
  const parts=['']
  let length=0
  for (const c of line) {
    const size=new TextEncoder().encode(c).length
    if(length+size>75){parts.push(' ');length=1}
    parts[parts.length-1]+=c
    length+=size
  }
  return parts.join('\r\n')
}
export const vcard=(data:Card[])=>data.map(c=>[
  'BEGIN:VCARD','VERSION:3.0','FN:'+esc(labelOf(c)),'N:'+esc(c.lastName)+';'+esc(c.firstName)+';;;',
  ...(c.company?['ORG:'+esc(c.company)+';'+esc(c.department)]:[]),
  ...(c.jobTitle?['TITLE:'+esc(c.jobTitle)]:[]),
  ...c.phoneNumbers.map(p=>'TEL;TYPE='+({mobile:'CELL',work:'WORK',fax:'FAX',other:'VOICE'}[p.kind])+':'+esc(p.number)),
  ...c.emailAddresses.map(e=>'EMAIL:'+esc(e)),...[...c.websites,...c.socialLinks].map(w=>'URL:'+esc(w)),
  ...c.addresses.map(a=>'ADR;TYPE=WORK:;;'+[a.street,a.city,'',a.postalCode,a.country].map(esc).join(';')),
  ...(c.notes?['NOTE:'+esc(c.notes)]:[]),...(c.tags.length?['CATEGORIES:'+c.tags.map(esc).join(',')]:[]),
  'END:VCARD','',
].map(foldLine).join('\r\n')).join('')
export const backup=(data:Card[])=>JSON.stringify({format:'kartvizit',version:1,cards:data})
const backupSchema=z.object({format:z.literal('kartvizit'),version:z.literal(1),cards:z.array(cardSchema).max(25000)})
export function readBackup(text:string) {
  const {cards}=backupSchema.parse(JSON.parse(text))
  if(new Set(cards.map(c=>c.id)).size!==cards.length) throw new Error('Repeated IDs')
  return cards
}
export async function deliver(file:File,share=false) {
  if(share && navigator.canShare?.({files:[file]})){
    try {await navigator.share({files:[file]});return}
    catch(error){if(error instanceof DOMException && error.name==='AbortError') return}
  }
  const url=URL.createObjectURL(file)
  const a=document.createElement('a')
  a.href=url
  a.download=file.name
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1500)
}
