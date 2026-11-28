import { useState } from 'react'
import { FileText, ScanLine, Save, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { cardSchema, cards, combine, duplicates, labelOf, normalizePhone, phoneKinds, type Card } from '../services/cards'
import type { Translate } from '../i18n'
import type { ScanPreview } from './Scanner'

export const phoneLabel=(t:Translate,kind:Card['phoneNumbers'][number]['kind'])=>({mobile:t('Cep telefonu','Mobile'),work:t('İş telefonu','Work'),fax:t('Faks','Fax'),other:t('Diğer','Other')})[kind]
const keys=['fullName','firstName','lastName','company','department','jobTitle'] as const
const autocomplete=['name','given-name','family-name','organization','off','organization-title']
export function Editor({initial,previews,t,close,onSaved,rescan}:{initial:Card;previews?:ScanPreview[];t:Translate;close:()=>void;onSaved:(id:string)=>void;rescan?:()=>void}) {
  const [draft,setDraft]=useState(initial)
  const [candidate,setCandidate]=useState<Card[]>([])
  const [target,setTarget]=useState('')
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [side,setSide]=useState(0)
  const [showPreview,setShowPreview]=useState(true)
  const photos=previews ?? initial.photos?.map(url=>({url,rotation:0,crop:{top:0,right:0,bottom:0,left:0}})) ?? []
  const visibleSide=photos[side]
  const duplicate=candidate.find(card=>card.id===target)
  const names=[t('Tam ad','Full name'),t('Ad','First name'),t('Soyad','Last name'),t('Şirket','Company'),t('Departman','Department'),t('Mesleki unvan','Job title')]
  const update=<K extends keyof Card,>(key:K,value:Card[K])=>{
    setCandidate([])
    setDraft(old=>({...old,[key]:value}))
  }
  const mark=(key:string)=>draft.fieldConfidence[key]!==undefined&&draft.fieldConfidence[key]<80?<span className="field-review">{t('Kontrol edin','Check')}</span>:null
  async function save(mode?:'new'|'replace'|'merge'){
    setError('')
    setSaving(true)
    try {
      const next=cardSchema.parse({...draft,
        ...Object.fromEntries(keys.map(key=>[key,draft[key].trim()])),
        fullName: draft.fullName.trim() || [draft.firstName.trim(),draft.lastName.trim()].filter(Boolean).join(' '),
        phoneNumbers:draft.phoneNumbers.filter(p=>p.number.trim()).map(p=>({...p,number:normalizePhone(p.number)||p.number.trim()})),
        emailAddresses:draft.emailAddresses.filter(s=>s.trim()).map(s=>s.trim()),websites:draft.websites.filter(s=>s.trim()).map(s=>s.trim()),socialLinks:draft.socialLinks.filter(s=>s.trim()).map(s=>s.trim()),
        addresses:draft.addresses.filter(a=>Object.values(a).some(value=>value.trim())),
        tags:[...new Set(draft.tags.map(s=>s.trim()).filter(Boolean))],updatedAt:new Date().toISOString(),
      })
      if(!labelOf(next) && !next.phoneNumbers.length && !next.emailAddresses.length) {
        setError(t('Bir ad, şirket, telefon veya e-posta girin.','Enter a name, company, phone or email.'));return
      }
      const id=await cards.db.transaction('rw',cards,async()=>{
        const matches=duplicates(next,await cards.toArray())
        if(matches.length&&!mode){
          setCandidate(matches);setTarget(matches[0].id);return
        }
        const existing=mode==='replace'||mode==='merge'?matches.find(m=>m.id===target):undefined
        if((mode==='replace'||mode==='merge')&&!existing)throw new Error('Duplicate changed')
        const record=cardSchema.parse(existing?combine(existing,next,mode==='merge'):next)
        await cards.put(record)
        return record.id
      })
      if(id)onSaved(id)
    } catch {setError(t('Kayıt tamamlanamadı. Alanları ve cihaz depolama alanını kontrol edin.','Save failed. Check the fields and device storage.'))}
    finally {setSaving(false)}
  }
  return <form className="screen-flow" onSubmit={e=>{e.preventDefault();void save()}}>
    <div className="page-heading"><div><h1>{initial.sourceType==='scan'?t('Kartviziti kontrol et','Review business card'):t('Kartvizit bilgileri','Business card details')}</h1><p>{t('İletişim bilgilerini kaydetmeden önce doğrulayın.','Verify the contact details before saving.')}</p></div><button type="button" className="icon-button" aria-label={t('Kapat','Close')} onClick={close}><X/></button></div>
    <div className={visibleSide?'editor-layout with-reference':'editor-layout'}>
    {visibleSide&&<aside className="panel scan-reference" aria-label={t('Kartvizit önizlemesi','Card preview')}>
      <div className="section-heading"><h2><ScanLine/>{t('Kartvizit görseli','Card image')}</h2><button type="button" className="preview-toggle" aria-controls="editor-preview" aria-expanded={showPreview} onClick={()=>setShowPreview(!showPreview)}>{showPreview?t('Gizle','Hide'):t('Göster','Show')}</button></div>
      <div id="editor-preview" hidden={!showPreview} className="screen-flow">
        {photos.length>1&&<div className="actions" role="group" aria-label={t('Kartvizit yüzü','Card side')}>{photos.map((photo,index)=><button type="button" key={photo.url} aria-pressed={side===index} onClick={()=>setSide(index)}>{index===0?t('Ön yüz','Front side'):t('Arka yüz','Back side')}</button>)}</div>}
        <div className="preview-image"><img src={visibleSide.url} alt={side?t('Arka yüz','Back side'):t('Ön yüz','Front side')} style={{transform:`rotate(${visibleSide.rotation}deg)`,clipPath:`inset(${visibleSide.crop.top}% ${visibleSide.crop.right}% ${visibleSide.crop.bottom}% ${visibleSide.crop.left}%)`}}/></div>
      </div>
    </aside>}
    <div className="screen-flow editor-fields">
    {draft.ocrConfidence!==null&&<div className="notice"><TriangleAlert/> <span>{t('OCR güveni','OCR confidence')} {Math.round(draft.ocrConfidence)}% · {t('İşaretli alanları kontrol edin.','Check the highlighted fields.')}</span></div>}
    <section className="panel screen-flow">
      <h2>{t('Kimlik ve şirket','Identity and company')}</h2>
      <div className="form-grid">
      {keys.map((key,i)=><label key={key}>{names[i]} <span id={key+'-review'}>{mark(key)}</span><input aria-label={names[i]} aria-describedby={draft.fieldConfidence[key]<80?key+'-review':undefined} maxLength={1500} value={draft[key]} autoComplete={autocomplete[i]} onChange={e=>update(key,e.target.value)}/></label>)}
      </div>
    </section>
    <section className="panel screen-flow">
      <h2>{t('İletişim','Contact')}</h2>
      <div className="field-list">
        <div className="section-heading"><h3>{t('Telefon numaraları','Phone numbers')} {mark('phoneNumbers')}</h3><button type="button" onClick={()=>update('phoneNumbers',[...draft.phoneNumbers,{number:'',kind:'mobile'}])}><Plus/>{t('Ekle','Add')}</button></div>
        {draft.phoneNumbers.map((phone,i)=><div className="inline-field" key={i}>
          <input aria-label={t('Telefon','Phone')+' '+(i+1)} type="tel" autoComplete="tel" value={phone.number} onChange={e=>update('phoneNumbers',draft.phoneNumbers.map((p,j)=>j===i?{...p,number:e.target.value}:p))}/>
          <select aria-label={t('Telefon türü','Phone type')} value={phone.kind} onChange={e=>update('phoneNumbers',draft.phoneNumbers.map((p,j)=>j===i?{...p,kind:e.target.value as typeof p.kind}:p))}>{phoneKinds.map(kind=><option key={kind} value={kind}>{phoneLabel(t,kind)}</option>)}</select>
          <button type="button" className="icon-button" aria-label={t('Telefonu kaldır','Remove phone')} onClick={()=>update('phoneNumbers',draft.phoneNumbers.filter((_,j)=>j!==i))}><Trash2/></button>
        </div>)}
      </div>
      {(['emailAddresses','websites','socialLinks'] as const).map((key,i)=>{
        const name=[t('E-posta adresleri','Email addresses'),t('Web siteleri','Websites'),t('Sosyal medya ve LinkedIn','Social and LinkedIn')][i]
        return <div className="field-list" key={key}>
          <div className="section-heading"><h3>{name} {mark(key)}</h3><button type="button" onClick={()=>update(key,[...draft[key],''])}><Plus/>{t('Ekle','Add')}</button></div>
          {draft[key].map((value,j)=><div className="inline-field" key={j}><input aria-label={name+' '+(j+1)} type={i===0?'email':'text'} inputMode={i===0?'email':'url'} autoComplete={i===0?'email':'url'} value={value} onChange={e=>update(key,draft[key].map((old,k)=>k===j?e.target.value:old))}/><button type="button" className="icon-button" aria-label={t('Alanı kaldır','Remove field')} onClick={()=>update(key,draft[key].filter((_,k)=>j!==k))}><Trash2/></button></div>)}
        </div>
      })}
      <div className="field-list"><div className="section-heading"><h3>{t('Adresler','Addresses')} {mark('addresses')}</h3><button type="button" onClick={()=>update('addresses',[...draft.addresses,{street:'',city:'',country:'',postalCode:''}])}><Plus/>{t('Ekle','Add')}</button></div>
        {draft.addresses.map((address,index)=><div className="form-grid address" key={index}>
          {(['street','city','country','postalCode'] as const).map((key,i)=><label key={key}>{[t('Açık adres','Street address'),t('Şehir','City'),t('Ülke','Country'),t('Posta kodu','Postal code')][i]}<input autoComplete={['street-address','address-level2','country-name','postal-code'][i]} value={address[key]} onChange={e=>update('addresses',draft.addresses.map((a,j)=>j===index?{...a,[key]:e.target.value}:a))}/></label>)}
          <button type="button" onClick={()=>update('addresses',draft.addresses.filter((_,j)=>j!==index))}><Trash2/>{t('Adresi kaldır','Remove address')}</button>
        </div>)}
      </div>
    </section>
    <section className="panel screen-flow">
      <h2>{t('Notlar ve etiketler','Notes and tags')}</h2>
      <div className="form-grid">
      <label>{t('Etiketler, virgülle ayırın','Tags, separated by commas')}<input value={draft.tags.join(',')} onChange={e=>update('tags',e.target.value.split(','))}/></label>
      <label>{t('Notlar','Notes')}<textarea rows={3} value={draft.notes} onChange={e=>update('notes',e.target.value)}/></label>
      <label className="check"><input type="checkbox" checked={draft.needsReview} onChange={e=>update('needsReview',e.target.checked)}/>{t('Daha sonra kontrol et','Review later')}</label>
      </div>
      {draft.rawOcrText&&<details><summary><FileText size={16}/>{t('Ham OCR metni','Raw OCR text')}</summary><pre>{draft.rawOcrText}</pre></details>}
    </section>
    {!!candidate.length&&<section className="panel duplicate screen-flow">
      <div role="alert"><h2><TriangleAlert/>{t('Benzer kayıt bulundu','Similar record found')}</h2></div>
      <label>{t('Mevcut kayıt','Existing record')}<select value={target} onChange={e=>setTarget(e.target.value)}>{candidate.map(c=><option key={c.id} value={c.id}>{labelOf(c)} {c.company&&' · '+c.company} {(c.emailAddresses[0]||c.phoneNumbers[0]?.number)&&' · '+(c.emailAddresses[0]||c.phoneNumbers[0].number)}</option>)}</select></label>
      {duplicate&&<div className="comparison-grid">{([
        [duplicate,t('Arşivdeki kart','Archived card')],
        [draft,t('Düzenlenen kart','Edited card')],
      ] as const).map(([card,label])=>
        <div key={label}><h3>{label}</h3><strong>{labelOf(card)}</strong><p>{card.company}</p><p>{[...card.emailAddresses,...card.phoneNumbers.map(phone=>phone.number)].join(' · ')}</p></div>
      )}</div>}
      <div className="actions"><button disabled={saving} type="button" onClick={()=>void save('replace')}>{t('Mevcut kaydı güncelle','Update existing')}</button><button disabled={saving} type="button" onClick={()=>void save('merge')}>{t('İki kaydı birleştir','Merge records')}</button><button disabled={saving} type="button" onClick={()=>void save('new')}>{t('Yeni kayıt olarak ekle','Save as new')}</button><button type="button" onClick={close}>{t('İşlemi iptal et','Cancel operation')}</button></div>
    </section>}
    {error&&<p className="notice" role="alert">{error}</p>}
    <div className="actions form-actions"><button className="primary" disabled={saving} type="submit"><Save/>{t('Kaydet','Save')}</button><button type="button" onClick={close}>{t('İptal','Cancel')}</button>{rescan&&<button type="button" onClick={rescan}>{t('Tarama ekranına dön','Return to scanner')}</button>}</div>
    </div>
    </div>
  </form>
}
