import { useEffect,useMemo,useState } from 'react'
import { Archive as ArchiveIcon, ArrowDownWideNarrow, ArrowLeftRight, Building2, ChevronDown, ChevronRight, Download, LayoutGrid, List, Plus, ScanLine, Search, Star, Tags, Trash2, TriangleAlert, X } from 'lucide-react'
import { labelOf,matches,type Card } from '../services/cards'
import type { Translate } from '../i18n'

export function Archive({data,favorites,t,scan,claude,manual,detail,favorite,exportCards,deleteCards,tagCards,openArchive}:{data:Card[];favorites:boolean;t:Translate;scan:()=>void;claude:()=>void;manual:()=>void;detail:(id:string)=>void;favorite:(card:Card)=>void;exportCards:(cards:Card[])=>void;deleteCards:(cards:Card[])=>void;tagCards:(cards:Card[])=>void;openArchive:()=>void}) {
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
  const emptyArchive = !data.length && !favorites
  const emptyFavorites = favorites && !starred
  const filtersActive = !!(query || company || tag || review)
  function clearFilters() {
    setQuery('')
    setDebounced('')
    setCompany('')
    setTag('')
    setReview(false)
    setLimit(60)
  }
  function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next})}
  return <section className="archive-flow">
    <div className="page-heading archive-heading">
      <div><h1>{favorites?t('Favoriler','Favorites'):t('Kartvizitler','Business cards')}</h1></div>
      <div className="actions archive-actions">
        <button className="primary" onClick={scan}><ScanLine/>{t('Kartvizit Tara','Scan a Card')}</button>
        <button onClick={manual}><Plus/>{t('Manuel ekle','Add manually')}</button>
        <button onClick={()=>exportCards(data)} disabled={!data.length}><Download/>{t('Dışa aktar','Export')}</button>
      </div>
    </div>
    <section className="archive-section" aria-label={favorites?t('Favori arşivi','Favorites archive'):t('Kartvizit arşivi','Card archive')}>
      <div className="toolbar">
        <label className="search"><Search/><input type="search" aria-label={t('Kartvizit ara','Search cards')} placeholder={t('İsim, şirket veya e-posta ara...','Search names, companies or emails...')} value={query} onChange={e=>{setQuery(e.target.value);setLimit(60)}}/></label>
        <label className="filter"><Building2/><select aria-label={t('Şirketler','Companies')} value={company} onChange={e=>{setCompany(e.target.value);setLimit(60)}}><option value="">{t('Tüm şirketler','All companies')}</option>{companies.map(c=><option key={c}>{c}</option>)}</select><ChevronDown/></label>
        <label className="filter"><Tags/><select aria-label={t('Etiketler','Tags')} value={tag} onChange={e=>{setTag(e.target.value);setLimit(60)}}><option value="">{t('Tüm etiketler','All tags')}</option>{tags.map(c=><option key={c}>{c}</option>)}</select><ChevronDown/></label>
        <label className="filter"><ArrowDownWideNarrow/><select aria-label={t('Sıralama','Sort')} value={sort} onChange={e=>{setSort(e.target.value);setLimit(60)}}><option value="new">{t('En yeni','Newest')}</option><option value="old">{t('En eski','Oldest')}</option><option value="az">{t('A → Z','A → Z')}</option></select><ChevronDown/></label>
      </div>
      <div className="section-heading archive-title">
        <div className="archive-summary">
          <span className="record-count" aria-live="polite">{filtered.length} {t('kartvizit','cards')}</span>
          {reviewCount>0&&!favorites&&<button className="review-filter" aria-pressed={review} onClick={()=>{setReview(!review);setLimit(60)}}><TriangleAlert/>{t('Kontrol bekleyen','Awaiting review')} <b>{reviewCount}</b></button>}
        </div>
        <div className="view-toggle" role="group" aria-label={t('Arşiv görünümü','Archive view')}><button className="icon-button" aria-pressed={!grid} aria-label={t('Liste görünümü','List view')} onClick={()=>setGrid(false)}><List/></button><button className="icon-button" aria-pressed={grid} aria-label={t('Kart görünümü','Grid view')} onClick={()=>setGrid(true)}><LayoutGrid/></button></div>
      </div>
      {review&&<button onClick={()=>setReview(false)}><X/>{t('Kontrol bekleyen filtresini kaldır','Clear awaiting review filter')}</button>}
      {!!filtered.length&&<div className="actions selection"><button onClick={()=>{setSelect(!select);setSelected(new Set())}}>{select?t('Seçimi bitir','Done selecting'):t('Çoklu seçim','Select multiple')}</button>
        {select&&<button onClick={()=>setSelected(new Set(checked.length===filtered.length?[]:filtered.map(c=>c.id)))}>{checked.length===filtered.length?t('Seçimi temizle','Clear selection'):t('Tümünü seç','Select all')}</button>}
        {select&&!!checked.length&&<><span>{checked.length} {t('seçildi','selected')}</span><button onClick={()=>exportCards(checked)}><Download/>{t('Dışa aktar','Export')}</button><button onClick={()=>tagCards(checked)}><Tags/>{t('Etiketle','Tag')}</button><button className="danger" onClick={()=>deleteCards(checked)}><Trash2/>{t('Sil','Delete')}</button></>}
      </div>}
      {filtered.length?<div className={grid?'contact-grid':'contact-list'}>{filtered.slice(0,limit).map(c=><article className="contact" key={c.id} data-selected={select&&selected.has(c.id)}>
        {select&&<label className="select-contact"><input aria-label={t('Seç','Select')+' '+labelOf(c)} type="checkbox" checked={selected.has(c.id)} onChange={()=>toggle(c.id)}/></label>}
        <button className="contact-main plain" onClick={()=>detail(c.id)}>
          <span className="avatar" aria-hidden="true">{labelOf(c).split(/\s+/).slice(0,2).map(x=>x[0]).join('').toLocaleUpperCase('tr')||'·'}</span>
          <span className="contact-text"><strong>{labelOf(c)||t('İsimsiz kartvizit','Unnamed card')}</strong><span>{[c.jobTitle,c.company].filter(Boolean).join(' · ')}</span><span className="contact-channel">{c.emailAddresses[0]||c.phoneNumbers[0]?.number}</span>{c.needsReview&&<span className="review-pill"><TriangleAlert/>{t('Kontrol','Review')}</span>}</span>
          <ChevronRight className="contact-chevron" aria-hidden="true"/>
        </button>
        <button className={'icon-button '+(c.isFavorite?'starred':'')} aria-label={t('Favori','Favorite')+' '+labelOf(c)} aria-pressed={c.isFavorite} onClick={()=>favorite(c)}><Star/></button>
      </article>)}</div>:<div className="empty">
        <div className="empty-art" aria-hidden="true"><i/><i/><span>{emptyFavorites?<Star/>:emptyArchive?<ArchiveIcon/>:<Search/>}</span></div>
        <h3>{emptyFavorites?t('Henüz favori yok','No favorites yet'):emptyArchive?t('Henüz kartvizit yok','No cards yet'):t('Eşleşen kartvizit bulunamadı','No matching cards')}</h3>
        <p>{emptyFavorites?t('Arşivde bir kartvizitin yanındaki yıldıza dokunarak favorilere ekleyin.','Star a card in the archive to add it here.'):emptyArchive?t('Bir kartvizitin fotoğrafını çekin, dosya seçin veya mevcut arşivinizi aktarın.','Take a photo, choose a file or import your existing archive.'):t('Arama teriminizi veya filtrelerinizi değiştirin.','Try a different search or clear your filters.')}</p>
        {emptyArchive&&<div className="actions"><button className="soft" onClick={scan}><Plus/>{t('İlk kartviziti ekle','Add your first card')}</button><button onClick={claude}><ArrowLeftRight/>{t('JSON aktarımı','JSON transfer')}</button></div>}
        {emptyFavorites&&<button className="soft" onClick={openArchive}><ArchiveIcon/>{t('Arşivi aç','Open archive')}</button>}
        {!emptyArchive&&!emptyFavorites&&filtersActive&&<button className="soft" onClick={clearFilters}><X/>{t('Aramayı ve filtreleri temizle','Clear search and filters')}</button>}
      </div>}
      {filtered.length>limit&&<button onClick={()=>setLimit(limit+60)}>{t('Daha fazla göster','Show more')}</button>}
    </section>
  </section>
}
