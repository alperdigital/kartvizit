import { useEffect,useMemo,useState } from 'react'
import { Archive as ArchiveIcon, ArrowDownWideNarrow, Building2, ChevronDown, ContactRound, Download, LayoutGrid, List, Plus, ScanLine, Search, Star, Tags, Trash2, TriangleAlert, Users, X } from 'lucide-react'
import { labelOf,matches,type Card } from '../services/cards'
import type { Translate } from '../i18n'

export function Archive({data,favorites,t,scan,manual,detail,favorite,exportCards,deleteCards,tagCards}:{data:Card[];favorites:boolean;t:Translate;scan:()=>void;manual:()=>void;detail:(id:string)=>void;favorite:(card:Card)=>void;exportCards:(cards:Card[])=>void;deleteCards:(cards:Card[])=>void;tagCards:(cards:Card[])=>void}) {
  const [query,setQuery]=useState('')
  const [debounced,setDebounced]=useState('')
  const [company,setCompany]=useState('')
  const [tag,setTag]=useState('')
  const [sort,setSort]=useState('new')
  const [review,setReview]=useState(false)
  const [grid,setGrid]=useState(false)
  const [select,setSelect]=useState(false)
  const [selected,setSelected]=useState<Set<string>>(new Set())
  const [limit,setLimit]=useState(60)
  useEffect(()=>{const timer=setTimeout(()=>setDebounced(query),150);return()=>clearTimeout(timer)},[query])
  const companies=useMemo(()=>[...new Set(data.map(c=>c.company).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')),[data])
  const tags=useMemo(()=>[...new Set(data.flatMap(c=>c.tags))].sort((a,b)=>a.localeCompare(b,'tr')),[data])
  const filtered=useMemo(()=>data.filter(c=>(!favorites||c.isFavorite)&&(!review||c.needsReview)&&(!company||c.company===company)&&(!tag||c.tags.includes(tag))&&(!debounced||matches(c,debounced))).sort((a,b)=>sort==='az'?labelOf(a).localeCompare(labelOf(b),'tr'):sort==='old'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt)),[data,favorites,review,company,tag,debounced,sort])
  const checked=filtered.filter(c=>selected.has(c.id))
  const reviewCount=data.filter(c=>c.needsReview).length
  const starred=data.filter(c=>c.isFavorite).length
  function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next})}
  return <section className="archive-flow">
    <div className="page-heading archive-heading"><div><p className="eyebrow"><span/>{t('KİŞİSEL ÇALIŞMA ALANI','PERSONAL WORKSPACE')}</p><h1>{favorites?t('Favoriler','Favorites'):t('Kartvizitler','Business cards')}</h1><p>{favorites?t('Yıldızladığınız kişilere hızlıca ulaşın.','Get to your starred contacts quickly.'):t('İş bağlantılarınızı tek bir yerden yönetin.','Manage all your business contacts in one place.')}</p></div><div className="actions"><button onClick={()=>exportCards(data)} disabled={!data.length}><Download/>{t('Dışa aktar','Export')}</button><button onClick={manual}><Plus/>{t('Manuel ekle','Add manually')}</button></div></div>
    {!favorites&&<div className="hero">
      <div className="hero-copy"><div className="hero-badge"><ScanLine/>{t('AKILLI TARAMA','SMART SCAN')}</div><h2>{t('Kartvizit tara','Scan a card')}</h2><p>{t('Bir fotoğraf çekin ya da galeriden seçin. İletişim bilgileri otomatik olarak doldurulsun.','Take a photo or choose one from your gallery to fill in contact details automatically.')}</p><button onClick={scan}><ScanLine/>{t('Kartvizit Tara','Scan a Card')}</button></div>
      <div className="hero-art" aria-hidden="true"><div className="art-grid"/><div className="art-card art-back"/><div className="art-card art-front"><div className="art-avatar"><ContactRound/></div><div className="art-lines"><i/><i/><i/></div><div className="art-bottom"><i/><i/></div></div><div className="focus-frame"><i/><i/><i/><i/></div><div className="art-scan"/></div>
    </div>}
    {!favorites&&<div className="metrics">
      <div className="metric"><span className="stat-icon blue"><Users/></span><div><p>{t('Toplam kartvizit','Total cards')}</p><strong>{data.length}</strong></div></div>
      <div className="metric"><span className="stat-icon gold"><Star/></span><div><p>{t('Favoriler','Favorites')}</p><strong>{starred}</strong></div></div>
      <button className="metric" aria-pressed={review} onClick={()=>{setReview(!review);setLimit(60)}}><span className="stat-icon violet"><TriangleAlert/></span><div><p>{t('Kontrol bekleyen','Awaiting review')}</p><strong>{reviewCount}</strong></div></button>
    </div>}
    <section className="archive-section">
      <div className="section-heading archive-title"><div><h2>{favorites?t('Favori arşivi','Favorites archive'):t('Kartvizit arşivi','Card archive')}</h2><span className="count-chip">{filtered.length}</span></div><div className="view-toggle"><button className="icon-button" aria-pressed={!grid} aria-label={t('Liste görünümü','List view')} onClick={()=>setGrid(false)}><List/></button><button className="icon-button" aria-pressed={grid} aria-label={t('Kart görünümü','Grid view')} onClick={()=>setGrid(true)}><LayoutGrid/></button></div></div>
      <div className="toolbar">
        <label className="search"><Search/><input type="search" aria-label={t('Kartvizit ara','Search cards')} placeholder={t('İsim, şirket veya e-posta ara...','Search names, companies or emails...')} value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}}/></label>
        <label className="filter"><Building2/><select aria-label={t('Şirketler','Companies')} value={company} onChange={e=>{setCompany(e.target.value);setLimit(60)}}><option value="">{t('Tüm şirketler','All companies')}</option>{companies.map(c=><option key={c}>{c}</option>)}</select><ChevronDown/></label>
        <label className="filter"><Tags/><select aria-label={t('Etiketler','Tags')} value={tag} onChange={e=>{setTag(e.target.value);setLimit(60)}}><option value="">{t('Tüm etiketler','All tags')}</option>{tags.map(c=><option key={c}>{c}</option>)}</select><ChevronDown/></label>
        <label className="filter"><ArrowDownWideNarrow/><select aria-label={t('Sıralama','Sort')} value={sort} onChange={e=>{setSort(e.target.value);setLimit(60)}}><option value="new">{t('En yeni','Newest')}</option><option value="old">{t('En eski','Oldest')}</option><option value="az">{t('A → Z','A → Z')}</option></select><ChevronDown/></label>
      </div>
      {review&&<button onClick={()=>setReview(false)}><X/>{t('Kontrol bekleyen filtresini kaldır','Clear awaiting review filter')}</button>}
      {!!filtered.length&&<div className="actions selection"><button onClick={()=>{setSelect(!select);setSelected(new Set())}}>{select?t('Seçimi bitir','Done selecting'):t('Çoklu seçim','Select multiple')}</button>
        {select&&<button onClick={()=>setSelected(new Set(checked.length===filtered.length?[]:filtered.map(c=>c.id)))}>{checked.length===filtered.length?t('Seçimi temizle','Clear selection'):t('Tümünü seç','Select all')}</button>}
        {select&&!!checked.length&&<><span>{checked.length} {t('seçildi','selected')}</span><button onClick={()=>exportCards(checked)}><Download/>{t('Dışa aktar','Export')}</button><button onClick={()=>tagCards(checked)}><Tags/>{t('Etiketle','Tag')}</button><button className="danger" onClick={()=>deleteCards(checked)}><Trash2/>{t('Sil','Delete')}</button></>}
      </div>}
      {filtered.length?<div className={grid?'contact-grid':'contact-list'}>{filtered.slice(0,limit).map(c=><article className="contact" key={c.id}>
        {select&&<label className="select-contact"><input aria-label={t('Seç','Select')+' '+labelOf(c)} type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)}/></label>}
        <button className="contact-main plain" onClick={()=>detail(c.id)}><span className="avatar">{labelOf(c).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toLocaleUpperCase('tr')||'·'}</span><span className="contact-text"><strong>{labelOf(c)||t('İsimsiz kartvizit','Unnamed card')}</strong><span>{[c.jobTitle,c.company].filter(Boolean).join(' · ')||c.emailAddresses[0]||c.phoneNumbers[0]?.number}</span></span>{c.needsReview&&<span className="review-pill">{t('Kontrol','Review')}</span>}</button>
        <button className={'icon-button '+(c.isFavorite?'starred':'')} aria-label={t('Favori','Favorite')+' '+labelOf(c)} aria-pressed={c.isFavorite} onClick={()=>favorite(c)}><Star/></button>
      </article>)}</div>:<div className="empty">
        <div className="empty-art"><i/><i/><span><ArchiveIcon/></span></div>
        <h3>{data.length?(favorites&&!starred?t('Henüz favori yok','No favorites yet'):t('Eşleşen kartvizit bulunamadı','No matching cards')):t('Henüz kartvizit yok','No cards yet')}</h3>
        <p>{data.length?t('Arama veya filtrelerinizi değiştirebilirsiniz.','Try adjusting your search or filters.'):t('İlk kartvizitinizi tarayarak arşivinizi oluşturmaya başlayın.','Scan your first card to start building your archive.')}</p>
        {!data.length&&!favorites&&<button className="soft" onClick={scan}><Plus/>{t('İlk kartviziti ekle','Add your first card')}</button>}
      </div>}
      {filtered.length>limit&&<button onClick={()=>setLimit(limit+60)}>{t('Daha fazla göster','Show more')}</button>}
    </section>
  </section>
}
