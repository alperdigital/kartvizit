import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { liveQuery } from 'dexie'
import { registerSW } from 'virtual:pwa-register'
import { Archive as ArchiveIcon, ArrowLeftRight, Check, Cloud, ContactRound, Copy, Download, HardDrive, Plus, ScanLine, Settings as SettingsIcon, ShieldCheck, Star, Wifi, WifiOff, X } from 'lucide-react'
import { Archive } from './features/Archive'
import { ClaudeScan, ClaudeTransfer } from './features/ClaudeTransfer'
import { claudeExport } from './services/claude-transfer'
import { Detail } from './features/Detail'
import { Dialog as Modal } from './features/Dialog'
import { Editor } from './features/Editor'
import { Scanner, type ScanPreview } from './features/Scanner'
import { Settings } from './features/Settings'
import { loadSettings } from './i18n'
import { cards, labelOf, newCard, type Card } from './services/cards'
import { clipboardTable, deliver, makeFile, type Format } from './services/export'
import { ocrReady, prepareOcr } from './services/ocr'
import './styles.css'

type Page='archive'|'scan'|'favorites'|'settings'
type Dialog={kind:'export'|'delete'|'tags';items:Card[];all?:boolean}
const empty:Card[]=[]
function App(){
  const [page,setPage]=useState<Page>('archive')
  const [method,setMethod]=useState<'device'|'claude'|'claude-scan'>()
  const [settings,setSettings]=useState(loadSettings)
  const [data,setData]=useState(empty)
  const [detail,setDetail]=useState<string>()
  const [editor,setEditor]=useState<{card:Card;scanId?:string;previews?:ScanPreview[]}>()
  const [saved,setSaved]=useState<string[]>([])
  const [dialog,setDialog]=useState<Dialog>()
  const [tags,setTags]=useState('')
  const [shareExport,setShareExport]=useState(false)
  const [busy,setBusy]=useState(false)
  const [toast,setToast]=useState('')
  const [storageError,setStorageError]=useState(false)
  const [online,setOnline]=useState(navigator.onLine)
  const [ocrStatus,setOcrStatus]=useState<string|boolean>(false)
  const [hasUpdate,setHasUpdate]=useState(false)
  const progress=useRef(false)
  const update=useRef<ReturnType<typeof registerSW>|undefined>(undefined)
  const t=(tr:string,en:string)=>settings.language==='tr'?tr:en
  useEffect(()=>{
    const subscription=liveQuery(()=>cards.toArray()).subscribe({next:setData,error:()=>setStorageError(true)})
    return()=>subscription.unsubscribe()
  },[])
  useEffect(()=>{
    const refresh=()=>void ocrReady().then(ready=>{if(!progress.current)setOcrStatus(ready)}).catch(()=>{})
    const network=()=>{setOnline(navigator.onLine);refresh()}
    update.current=registerSW({immediate:true,onNeedRefresh:()=>setHasUpdate(true),onOfflineReady:refresh})
    refresh()
    window.addEventListener('online',network)
    window.addEventListener('offline',network)
    navigator.serviceWorker?.addEventListener('controllerchange',refresh)
    return()=>{window.removeEventListener('online',network);window.removeEventListener('offline',network);navigator.serviceWorker?.removeEventListener('controllerchange',refresh)}
  },[])
  useEffect(()=>{
    document.documentElement.lang=settings.language
    document.documentElement.dataset.theme=settings.theme
    try{localStorage.setItem('kartvizit-settings',JSON.stringify(settings))}catch{/* Storage access may be denied. */}
  },[settings])
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),5500);return()=>clearTimeout(timer)},[toast])
  function go(next:Page){setPage(next);setEditor(undefined);setDetail(undefined);if(next!=='scan'){setSaved([]);setMethod(undefined)};window.scrollTo(0,0)}
  function showDetail(id:string){setDetail(id);window.scrollTo(0,0)}
  function openEditor(card:Card,scanId?:string,previews?:ScanPreview[]){setEditor({card,scanId,previews});window.scrollTo(0,0)}
  async function favorite(c:Card){
    try{await cards.db.transaction('rw',cards,async()=>{const current=await cards.get(c.id);if(current)await cards.update(c.id,{isFavorite:!current.isFavorite,updatedAt:new Date().toISOString()})})}
    catch{setToast(t('Favori güncellenemedi.','Could not update favorite.'))}
  }
  async function prepare(){
    if(progress.current)return
    progress.current=true
    try {
      await prepareOcr((done,total)=>setOcrStatus(done+'/'+total))
      setOcrStatus(await ocrReady())
      setToast(t('OCR kaynakları indirildi.','OCR resources downloaded.'))
    }catch{setOcrStatus(false);setToast(t('OCR kaynakları indirilemedi. Bağlantınızı ve depolama alanını kontrol edin.','Could not download OCR resources. Check the connection and storage.'))}
    finally{progress.current=false}
  }
  async function operation(callback:()=>Promise<void>,close=true){
    setBusy(true)
    try{await callback();if(close)setDialog(undefined)}
    catch{setToast(t('İşlem tamamlanamadı. Cihaz izinlerini ve depolama alanını kontrol edin.','The operation failed. Check device permissions and available storage.'))}
    finally{setBusy(false)}
  }
  function exportItems(items:Card[],format:Format,share=false){void operation(async()=>deliver(await makeFile(items,format),share),false)}
  const navigation=[{id:'archive',name:t('Kartvizitler','Cards'),Icon:ArchiveIcon},{id:'scan',name:t('Tara','Scan'),Icon:ScanLine},{id:'favorites',name:t('Favoriler','Favorites'),Icon:Star},{id:'settings',name:t('Ayarlar','Settings'),Icon:SettingsIcon}] as const
  const current=data.find(c=>c.id===detail)
  const isArchive=page==='archive'||page==='favorites'
  const status=typeof ocrStatus==='string'?t('Kaynaklar indiriliyor','Downloading resources')+' · '+ocrStatus:ocrStatus?t('Çevrimdışı tarama hazır','Offline scanning ready'):t('Çevrimdışı tarama için OCR kaynaklarını indirin. İlk taramada gereken dosyalar internetten alınır.','Download OCR resources for offline scanning. The first scan fetches the required files online.')
  const ocrState=ocrStatus===true?'ready':typeof ocrStatus==='string'?'loading':'idle'
  const scanMethods=[
    { id:'device', Icon:ScanLine, name:t('Cihazda Tara','Scan on device'), description:t('Kamera veya galeriden kart ekleyin.','Add a card from your camera or gallery.') },
    { id:'claude-scan', Icon:Cloud, name:t('Claude ile Tara','Scan with Claude'), description:t('Claude oturumunuzu veya özel Yapıtınızı açın.','Open your Claude session or private Artifact.') },
    { id:'claude', Icon:ArrowLeftRight, name:t('JSON aktarımı','JSON transfer'), description:t('Dosyadan veya panodan kart aktarın.','Transfer cards by file or clipboard.') },
  ] as const
  const exportFormats=[
    { id:'xlsx', label:'Excel', hint:t('Biçimlendirilmiş tablo','Formatted spreadsheet') },
    { id:'csv', label:'CSV', hint:t('Diğer uygulamalar için tablo','Table for other apps') },
    { id:'vcf', label:'vCard', hint:t('Telefon rehberi','Phone contacts') },
    { id:'json', label:'JSON', hint:t('Tam cihaz yedeği','Full device backup') },
  ] as const
  const openExport=(items:Card[])=>{setShareExport(false);setDialog({kind:'export',items})}
  return <div className="layout" data-editing={!!editor}>
    <a className="skip-link" href="#content">{t('İçeriğe geç','Skip to content')}</a>
    <aside className="sidebar">
      <button className="brand plain" onClick={()=>go('archive')}><span className="brand-icon"><ContactRound/></span><span>Kartvizit</span></button>
      <nav aria-label={t('Ana menü','Main navigation')}>{navigation.map(({id,name,Icon})=><button key={id} className={'nav-item '+(id===page?'active ':'')+(id==='scan'?'scan-nav':'')} onClick={()=>go(id)} aria-current={id===page?'page':undefined}><Icon/><span>{name}</span></button>)}</nav>
      <div className="sidebar-foot"><span className="privacy-icon"><ShieldCheck/></span><strong>{t('Arşiviniz bu cihazda','Your archive is on this device')}</strong></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><ArchiveIcon/><strong>{t('Kişi arşivi','Contacts archive')}</strong></div><button className="mobile-brand plain" onClick={()=>go('archive')}><span className="brand-icon"><ContactRound/></span>Kartvizit</button><div className="network" data-online={online} role="status">{online?<Wifi/>:<WifiOff/>}<span>{online?t('Çevrimiçi','Online'):t('Çevrimdışı','Offline')}</span></div></header>
      <main id="content" tabIndex={-1}>
        {hasUpdate&&<div className="notice">{t('Yeni sürüm hazır. Açık formları kaydettikten sonra güncelleyin.','An update is ready. Save open forms before updating.')} <button onClick={()=>void update.current?.(true)}>{t('Güncelle','Update')}</button></div>}
        {storageError&&<p className="notice" role="alert">{t('Yerel arşiv açılamadı. Tarayıcının depolama izinlerini kontrol edin.','The local archive could not open. Check browser storage permissions.')}</p>}
        {page==='scan'&&<div hidden={!!editor} className="screen-flow">
          <div className="page-heading"><h1>{t('Kartvizit ekle','Add a business card')}</h1><button onClick={()=>openEditor(newCard())}><Plus/>{t('Manuel ekle','Add manually')}</button></div>
          <div className="scan-methods" data-chosen={!!method} role="group" aria-label={t('Ekleme yöntemi','Adding method')}>
            {scanMethods.map(({id,Icon,name,description})=><button key={id} aria-label={name} aria-describedby={`method-${id}-hint`} aria-pressed={method===id} onClick={()=>setMethod(id)}>
              <span className="method-icon"><Icon/></span><span><strong>{name}</strong><small id={`method-${id}-hint`}>{description}</small></span>
            </button>)}
          </div>
          {method==='claude-scan'&&<ClaudeScan t={t} online={online}/>}
          {method==='claude'&&<ClaudeTransfer t={t} notify={setToast} online={online}/>}
          {method&&<div hidden={method!=='device'} className="screen-flow"><div className="scan-status" data-state={ocrState}><HardDrive/><span role="status">{status}</span>{ocrStatus!==true&&<button className="plain" disabled={ocrState==='loading'} onClick={()=>void prepare()}>{t('OCR kaynaklarını indir','Download OCR resources')}</button>}</div><Scanner t={t} settings={settings} onReview={openEditor} saved={saved}/></div>}
        </div>}
        {editor?<Editor key={editor.card.id} initial={editor.card} previews={editor.previews} t={t} close={()=>setEditor(undefined)} rescan={editor.scanId?()=>setEditor(undefined):undefined} onSaved={id=>{
          if(editor.scanId){setSaved(old=>[...old,editor.scanId!]);setEditor(undefined)}
          else {go('archive');showDetail(id)}
          setToast(t('Kartvizit kaydedildi.','Card saved.'))
        }}/>:
          current?<Detail c={current} t={t} back={()=>setDetail(undefined)} edit={()=>openEditor(current)} favorite={()=>void favorite(current)} remove={()=>setDialog({kind:'delete',items:[current]})} exportCard={share=>exportItems([current],'vcf',share)}/>:
          isArchive?<Archive key={page} data={data} favorites={page==='favorites'} t={t} scan={()=>go('scan')} claude={()=>{go('scan');setMethod('claude')}} manual={()=>openEditor(newCard())} detail={showDetail} favorite={c=>void favorite(c)} exportCards={openExport} deleteCards={items=>setDialog({kind:'delete',items})} tagCards={items=>{setTags('');setDialog({kind:'tags',items})}} openArchive={()=>go('archive')}/>:
          page==='settings'?<Settings t={t} value={settings} change={setSettings} prepare={()=>void prepare()} ocrStatus={status} ocrState={ocrState} onExport={()=>openExport(data)} onDelete={()=>setDialog({kind:'delete',items:data,all:true})} notify={setToast}/>:null}
      </main>
    </div>
    <nav className="bottom-nav" aria-label={t('Alt menü','Bottom navigation')}>{navigation.map(({id,name,Icon})=><button key={id} className={(id===page?'active ':'')+(id==='scan'?'scan-nav':'')} aria-current={id===page?'page':undefined} onClick={()=>go(id)}><Icon/>{name}</button>)}</nav>
    {toast&&<div className="toast" role="status"><Check/>{toast}<button className="icon-button" aria-label={t('Bildirimi kapat','Dismiss notification')} onClick={()=>setToast('')}><X/></button></div>}
    {dialog&&<Modal title={dialog.kind==='export'?t('Dışa aktar','Export'):dialog.kind==='tags'?t('Etiket ekle','Add tags'):t('Silme işlemini onayla','Confirm deletion')} close={()=>{if(!busy)setDialog(undefined)}}>
      {dialog.kind==='export'?<><p>{dialog.items.length} {t('kartvizit','cards')}</p><div className="export-formats">
        {exportFormats.map(({id,label,hint})=><button aria-label={label} disabled={busy} key={id} onClick={()=>exportItems(dialog.items,id,shareExport)}><Download/><span><strong>{label}</strong><small>{hint}</small></span></button>)}
      </div><div className="actions">
        <button disabled={busy} onClick={()=>void operation(async()=>{await navigator.clipboard.writeText(clipboardTable(dialog.items));setToast(t('Tablo panoya kopyalandı.','Table copied.'))},false)}><Copy/>{t('Tabloyu kopyala','Copy table')}</button>
        <button disabled={busy} onClick={()=>void operation(async()=>deliver(new File([claudeExport(dialog.items)],'kartvizit-claude.json',{type:'application/json'}),shareExport),false)}><Download/>{t('Fotoğrafsız JSON indir','Download photo-free JSON')}</button>
        <button disabled={busy} onClick={()=>void operation(async()=>{await navigator.clipboard.writeText(claudeExport(dialog.items));setToast(t('Fotoğrafsız JSON kopyalandı.','Photo-free JSON copied.'))},false)}><Copy/>{t('Fotoğrafsız JSON kopyala','Copy photo-free JSON')}</button>
      </div>{typeof navigator.canShare==='function'&&<label className="check"><input type="checkbox" checked={shareExport} onChange={e=>setShareExport(e.target.checked)}/>{t('Dosyayı paylaş','Share the file')}</label>}</>:dialog.kind==='delete'?<><p>{dialog.items.length===1&&labelOf(dialog.items[0])?<><strong>{labelOf(dialog.items[0])}</strong> {t('cihazdan silinecek. Bu işlem geri alınamaz.','will be removed from this device. This cannot be undone.')}</>:t(`${dialog.items.length} kartvizit cihazdan silinecek. Bu işlem geri alınamaz.`,`${dialog.items.length} cards will be removed from this device. This cannot be undone.`)}</p><div className="actions"><button onClick={()=>setDialog(undefined)} disabled={busy}>{t('İptal','Cancel')}</button><button className="danger danger-confirm" disabled={busy} onClick={()=>void operation(async()=>{if(dialog.all)await cards.clear();else await cards.bulkDelete(dialog.items.map(c=>c.id));setDetail(undefined);setToast(t('Kayıtlar silindi.','Cards deleted.'))})}>{dialog.all?t('Tümünü kalıcı sil','Permanently delete all'):t('Kalıcı sil','Permanently delete')}</button></div></>:<form className="screen-flow" onSubmit={e=>{e.preventDefault();void operation(async()=>{
        const added=tags.split(',').map(s=>s.trim()).filter(Boolean)
        await cards.db.transaction('rw',cards,async()=>{
          const latest=await cards.bulkGet(dialog.items.map(c=>c.id))
          await cards.bulkPut(latest.filter(c=>c!==undefined).map(c=>({...c,tags:[...new Set([...c.tags,...added])].slice(0,100),updatedAt:new Date().toISOString()})))
        })
      })}}><label>{t('Etiketler, virgülle ayırın','Tags, separated by commas')}<input maxLength={1200} value={tags} onChange={e=>setTags(e.target.value)} required/></label><button className="primary" disabled={busy} type="submit">{t('Etiketleri ekle','Add tags')}</button></form>}
    </Modal>}
  </div>
}
createRoot(document.getElementById('root')!).render(<App/>)

