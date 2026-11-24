import { fold, newCard, normalizePhone, type Card } from './cards'
export interface OcrLine { text:string; confidence:number; height?:number }
export interface OcrResult { text:string; confidence:number; lines:OcrLine[] }
const title = /\b(genel mudur|yonetim kurulu baskani|satis muduru|bilgisayar muhendisi|mimar|avukat|doktor|kurucu|yonetici|mudur|muhendis|ceo|cto|cfo|founder|manager|director|engineer|architect|attorney|president)\b/
const organization = /\b(ltd|llc|inc|corp|gmbh|sirketi|holding|group|studio|teknoloji|technology|teknolojileri|ajans|agency|a\s?\.\s?s)\b/
const address = /\b(adres|address|mah(?:alle)?|sok(?:ak)?|cad(?:de)?|street|avenue|boulevard|postal|zip)\b/
const website = /(?:https?:\/\/|www\.)[^\s,;<>]+|\b(?:[a-z\d-]+\.)+(?:com(?:\.tr)?|org(?:\.tr)?|net|io|co(?:\.uk)?|tr|dev|biz|info)(?:\/[^\s,;<>]*)?/gi
const email = /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi
const phone = /(?:\+|00)?\d[\d\s().-]{6,}\d/g
export class BusinessCardParser {
  parse(result:OcrResult):Card {
    const card = newCard('scan')
    card.rawOcrText=result.text.slice(0,30000)
    card.ocrConfidence=result.confidence
    const candidates:OcrLine[]=[]
    const set = <K extends keyof Card>(key:K,value:Card[K],line:OcrLine,limit=100) => {
      card[key]=value
      card.fieldConfidence[key]=Math.min(card.fieldConfidence[key]??100,line.confidence,limit)
    }
    const lines=result.lines.length ? result.lines : result.text.split('\n').map(text=>({text,confidence:result.confidence}))
    for (const source of lines) {
      const line={...source,text:source.text.trim().slice(0,1500)}
      if (!line.text) continue
      const text=line.text
      const normalized=fold(text)
      const emails=text.match(email)??[]
      const urls=text.replace(email,'').match(website)??[]
      if (emails.length) set('emailAddresses',[...new Set([...card.emailAddresses,...emails])],line)
      for (const match of urls) {
        const url=match.replace(/[.)]+$/,'')
        const key=/(linkedin\.com|instagram\.com|facebook\.com|x\.com|twitter\.com)/i.test(url)?'socialLinks':'websites'
        set(key,[...new Set([...card[key],url])],line)
      }
      if (emails.length || urls.length) continue
      if (address.test(normalized) || /^(?:sehir|city|country|ulke|postcode|posta kodu)\s*:/.test(normalized)) {
        const current=card.addresses[0]??{street:'',city:'',country:'',postalCode:''}
        const value=text.replace(/^[^:]+:\s*/,'')
        if (/^(sehir|city)\s*:/.test(normalized)) current.city=value
        else if (/^(ulke|country)\s*:/.test(normalized)) current.country=value
        else if (/^(postal|zip|postcode|posta kodu)/.test(normalized)) current.postalCode=value
        else {
          current.street=[current.street,value].filter(Boolean).join(', ')
          current.postalCode ||= value.match(/\b\d{5}\b/)?.[0]??''
        }
        set('addresses',[current],line,79)
        continue
      }
      const phones=[...text.matchAll(phone)].map(m=>{
        const previous=text.slice(0,m.index).split(/\s{2,}|[|;]/).at(-1)??''
        const hint=fold(previous).replace(/[\d().+ -]+/g,' ')
        const kind=/\b(faks|fax)\b/.test(hint)?'fax':/\b(gsm|cep|mobile|mobil)\b/.test(hint)?'mobile':/\b(tel|office|telefon|work)\b/.test(hint)?'work':'other'
        return {number:normalizePhone(m[0]),kind} as Card['phoneNumbers'][number]
      }).filter(p=>p.number.replace(/\D/g,'').length>=7 && p.number.replace(/\D/g,'').length<=15)
      if (phones.length) {
        set('phoneNumbers',[...new Map([...card.phoneNumbers,...phones].map(p=>[p.number,p])).values()],line)
      } else if (/^(departman|department|birim)\s*:/.test(normalized)) {
        set('department',text.split(':').slice(1).join(':').trim(),line)
      } else if (/^(notlar?|notes?)\s*:/.test(normalized)) {
        set('notes',text.split(':').slice(1).join(':').trim(),line)
      } else if (!card.jobTitle && title.test(normalized)) {
        set('jobTitle',text,line,89)
      } else if (!card.company && organization.test(normalized)) {
        set('company',text,line,79)
      } else if (/^\p{L}+(?:[ '\u2019-]\p{L}+){1,3}$/u.test(text)) {
        candidates.push(line)
      }
    }
    const name=candidates.reduce<OcrLine|undefined>((best,line)=>!best||(line.height??0)>(best.height??0)*1.2 ? line:best,undefined)
    if (name) {
      const parts=name.text.split(/\s+/)
      set('fullName',name.text,name,76)
      set('lastName',parts.pop()??'',name,72)
      set('firstName',parts.join(' '),name,72)
    }
    card.needsReview=result.confidence<85 || Object.values(card.fieldConfidence).some(value=>value<80) || !name
    return card
  }
}
