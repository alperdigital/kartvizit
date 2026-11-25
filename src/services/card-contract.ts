import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'

const short = z.string().max(1500)
const long = z.string().max(30000)
const list = z.array(short).max(100)
export const phoneKinds = ['mobile','work','fax','other'] as const
export const cardSchema = z.object({
  id: z.uuid(), firstName: short, lastName: short, fullName: short,
  company: short, department: short, jobTitle: short,
  phoneNumbers: z.array(z.object({number: short, kind: z.enum(phoneKinds)})).max(100),
  emailAddresses: list, websites: list, socialLinks: list,
  addresses: z.array(z.object({street:short, city:short, country:short, postalCode:short})).max(100),
  notes: long, tags: list, isFavorite: z.boolean(), rawOcrText: long,
  ocrConfidence: z.number().min(0).max(100).nullable(),
  fieldConfidence: z.record(z.string(),z.number().min(0).max(100)),
  needsReview: z.boolean(), createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  sourceType: z.enum(['manual','scan']), scanEngine:z.enum(['claude','tesseract','manual']).optional(), photos: z.array(z.string().max(3000000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)).max(2).optional(),
})
export type Card = z.infer<typeof cardSchema>
export function newCard(sourceType: Card['sourceType'] = 'manual'): Card {
  const now = new Date().toISOString()
  return {id:crypto.randomUUID(),firstName:'',lastName:'',fullName:'',company:'',department:'',jobTitle:'',
    phoneNumbers:[],emailAddresses:[],websites:[],addresses:[],socialLinks:[],notes:'',tags:[],isFavorite:false,
    rawOcrText:'',ocrConfidence:null,fieldConfidence:{},needsReview:false,createdAt:now,updatedAt:now,sourceType,scanEngine:sourceType==='scan'?'tesseract':'manual'}
}
export const fold = (value:string) => value.toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFD').replace(/\p{M}/gu,'')
export function normalizePhone(value:string) {
  const input = value.trim().replace(/^00/,'+')
  const parsed = parsePhoneNumberFromString(input,'TR')
  return parsed?.isPossible() ? parsed.number : input.replace(/[^\d+]/g,'')
}
export const labelOf = (c:Card) => c.fullName || [c.firstName,c.lastName].filter(Boolean).join(' ') || c.company
export function matches(c:Card, query:string) {
  const fields = fold([c.fullName,c.firstName,c.lastName,c.company,c.jobTitle,c.department,c.notes,...c.tags,...c.emailAddresses,
    ...c.addresses.flatMap(a=>Object.values(a)),...c.phoneNumbers.flatMap(p=>[p.number,normalizePhone(p.number)])].join(' '))
  return fold(query.trim()).split(/\s+/).every(token=>fields.includes(token))
}
function similar(a:string,b:string) {
  if (!a || !b) return false
  if (a===b) return true
  if (a.length<6 || Math.abs(a.length-b.length)>1) return false
  const [small,big] = a.length>b.length ? [b,a] : [a,b]
  const at = [...small].findIndex((ch,i)=>ch!==big[i])
  if (at<0) return true
  return small.slice(at+(small.length===big.length?1:0))===big.slice(at+1)
}
export const normalizedCardName = (card: Card) => fold(card.fullName.trim() || [card.firstName, card.lastName].join(' ')).trim().replace(/\s+/g, ' ')
export function duplicates(c:Card, existing:Card[]) {
  const email = new Set(c.emailAddresses.map(e=>e.trim().toLowerCase()))
  const phones = new Set(c.phoneNumbers.map(p=>normalizePhone(p.number)).filter(p=>p.length>=7))
  const name = normalizedCardName(c)
  return existing.filter(p=>p.id!==c.id && (p.emailAddresses.some(e=>email.has(e.trim().toLowerCase())) ||
    p.phoneNumbers.some(n=>phones.has(normalizePhone(n.number))) ||
    Boolean(name && normalizedCardName(p) === name) ||
    !!c.company && fold(p.company)===fold(c.company) && similar(normalizedCardName(p),name)))
}
const unique = <T>(values:T[]) => [...new Map(values.map(value=>[JSON.stringify(value),value])).values()]
export function combine(old:Card, next:Card, merge:boolean):Card {
  const common = {...next,id:old.id,createdAt:old.createdAt,isFavorite:old.isFavorite,photos:next.photos ?? old.photos}
  if (!merge) return common
  return {...common,
    firstName:next.firstName||old.firstName,lastName:next.lastName||old.lastName,fullName:next.fullName||old.fullName,
    company:next.company||old.company,department:next.department||old.department,jobTitle:next.jobTitle||old.jobTitle,
    tags:unique([...old.tags,...next.tags]),phoneNumbers:unique([...old.phoneNumbers,...next.phoneNumbers]),
    emailAddresses:unique([...old.emailAddresses,...next.emailAddresses]),websites:unique([...old.websites,...next.websites]),
    socialLinks:unique([...old.socialLinks,...next.socialLinks]),addresses:unique([...old.addresses,...next.addresses]),
    notes:unique([old.notes,next.notes].filter(Boolean)).join('\n'),rawOcrText:unique([old.rawOcrText,next.rawOcrText].filter(Boolean)).join('\n'),
    ocrConfidence:next.ocrConfidence??old.ocrConfidence,fieldConfidence:{...old.fieldConfidence,...next.fieldConfidence}}
}
export function safeUrl(value:string) {
  value=value.trim()
  if (!value || value.startsWith('/') || value.startsWith('\\') || [...value].some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127)) return undefined
  try {
    const url = new URL(/^[\w+.-]+:\/\//.test(value) || /^(javascript|data|file|vbscript|blob):/i.test(value) ? value : 'https://'+value)
    return ['http:','https:'].includes(url.protocol) && url.hostname.includes('.') && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}
