import { ArrowLeft, Building2, Download, Mail, MapPin, MessageCircle, Pencil, Phone, ScanLine, Share2, Star, Trash2 } from 'lucide-react'
import { labelOf, normalizePhone, safeUrl, type Card } from '../services/cards'
import { addressText } from '../services/export'
import type { Translate } from '../i18n'
import { phoneLabel } from './Editor'
export function Detail({c,t,back,edit,favorite,remove,exportCard}:{c:Card;t:Translate;back:()=>void;edit:()=>void;favorite:()=>void;remove:()=>void;exportCard:(share:boolean)=>void}){
  const name=labelOf(c)
  const initials=name.split(/\s+/).slice(0,2).map(part=>part[0]).join('').toLocaleUpperCase('tr')
  const hasPhotos=!!c.photos?.length
  return <section className="screen-flow">
    <div className="actions"><button onClick={back}><ArrowLeft/>{t('Arşive dön','Back to archive')}</button></div>
    <div className="panel screen-flow">
      <div className="section-heading"><div className="detail-title">
        <span className="avatar" aria-hidden="true">{initials||'·'}</span>
        <div><h1>{name||t('İsimsiz kartvizit','Unnamed card')}</h1><p>{[c.jobTitle,c.department,c.company].filter(Boolean).join(' · ')}</p></div>
      </div><button className={'icon-button '+(c.isFavorite?'starred':'')} aria-label={t('Favori','Favorite')} aria-pressed={c.isFavorite} onClick={favorite}><Star/></button></div>
      <div className="actions"><button className="primary" onClick={edit}><Pencil/>{t('Düzenle','Edit')}</button><button onClick={()=>exportCard(true)}><Share2/>{t('Paylaş','Share')}</button><button onClick={()=>exportCard(false)}><Download/>{t('Rehbere ekle (.vcf)','Add to contacts (.vcf)')}</button><button className="danger" onClick={remove}><Trash2/>{t('Sil','Delete')}</button></div>
    </div>
    <div className={hasPhotos?'detail-grid with-photos':'detail-grid'}>
    <div className="panel screen-flow">
      <h2>{t('İletişim bilgileri','Contact information')}</h2>
      {c.phoneNumbers.map((p,i)=>{
        const number=normalizePhone(p.number)
        return <div key={i} className="actions"><a className="button" href={/^[+]?[0-9]{7,15}$/.test(number)?'tel:'+number:undefined}><Phone/>{phoneLabel(t,p.kind)} · {p.number}</a>{p.kind!=='fax'&&/^\+[1-9]\d{6,14}$/.test(number)&&<a className="button" href={'https://wa.me/'+number.slice(1)} target="_blank" rel="noopener noreferrer"><MessageCircle/>WhatsApp</a>}</div>
      })}
      {c.emailAddresses.map((e,i)=><a className="detail-link" key={i} href={/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(e)?'mailto:'+encodeURIComponent(e):undefined}><Mail/>{e}</a>)}
      {[...c.websites,...c.socialLinks].map((url,i)=><a className="detail-link" key={i} href={safeUrl(url)} target="_blank" rel="noopener noreferrer"><Building2/>{url}</a>)}
      {c.addresses.map((a,i)=><a className="detail-link" key={i} href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(addressText(a))} target="_blank" rel="noopener noreferrer"><MapPin/>{addressText(a)}</a>)}
      {c.tags.length>0&&<div className="actions">{c.tags.map(tag=><span className="chip" key={tag}>{tag}</span>)}</div>}
      {c.notes&&<div><h3>{t('Notlar','Notes')}</h3><p className="preserve">{c.notes}</p></div>}
      {!c.phoneNumbers.length&&!c.emailAddresses.length&&!c.websites.length&&!c.socialLinks.length&&!c.addresses.length&&<p>{t('İletişim bilgisi eklenmemiş.','No contact information added.')}</p>}
    </div>
    {hasPhotos&&<section className="panel screen-flow"><h2><ScanLine/>{t('Kartvizit görselleri','Card images')}</h2>{c.photos?.map((photo,i)=>{
      const side=i===0?t('Ön yüz','Front side'):t('Arka yüz','Back side')
      return <figure className="detail-photo" key={i}><figcaption>{side}</figcaption><img className="saved-photo" src={photo} alt={side}/></figure>
    })}</section>}
    </div>
  </section>
}
