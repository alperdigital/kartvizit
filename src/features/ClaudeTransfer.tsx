import {useEffect,useState} from 'react'
import {Download, Upload, ExternalLink, Copy, Share2} from 'lucide-react'
import {cards,labelOf, type Card} from '../services/cards'
import {deliver} from '../services/export'
import {claudeExport,compareContact,inspectTransfer,importClaudeTransfer,planTransfer,transferLimit,transferState,type TransferChoice,type TransferDecision,type TransferInput,type TransferReport} from '../services/claude-transfer'
import type {Translate} from '../i18n'

const linkKey='kartvizit-claude-artifact'
const obsoleteExample='https://claude.ai/artifact/5aZ3uLS5ZtFxYkCj8Cqnzi'
function loadLink(){
  try{
    const override=localStorage.getItem(linkKey)
    return override && override!==obsoleteExample ? override : ''
  }catch{return ''}
}
export function artifactUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['https://claude.ai', 'https://claude.com'].includes(url.origin) ||
      url.username || url.password || url.hash) return undefined
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
    const parts = url.pathname.split('/').filter(Boolean)
    const id = parts.length === 3 && parts[0] === 'code' && parts[1] === 'artifact' ? parts[2] :
      parts.length === 2 && parts[0] === 'chat' && uuid.test(parts[1]) ? url.searchParams.get('artifact') : null
    if (id && uuid.test(id)) return 'https://claude.ai/code/artifact/' + id
    if (!url.search && /^\/(artifact|artifacts|public\/artifacts)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname) &&
      url.href.replace(/\/$/,'') !== obsoleteExample) return url.href
  } catch {
    return undefined
  }
}
function setLocalArtifact(value: string) {
  try {
    const link = artifactUrl(value)
    if (link) localStorage.setItem(linkKey, link)
    else if (!value.trim()) localStorage.removeItem(linkKey)
  } catch { /* Storage can be unavailable. */ }
}

export function ClaudeScan({t, online}:{t:Translate;online:boolean}) {
  const [link, setLink] = useState(loadLink)
  const url = artifactUrl(link)
  return <section className="panel screen-flow claude-transfer" aria-label={t('Claude taraması','Claude scan')}>
    <h2>{t('Claude ile kartvizit tara','Scan a business card with Claude')}</h2>
    <p>{t('Görseli Claude Yapıtında yükleyin. Tarama için internet ve Yapıta erişimi olan bir Claude hesabı gerekir. Tarama hesabınızın Claude kotasından kullanır.','Upload the image in the Claude Artifact. Scanning requires internet access and a Claude account with access to the Artifact. Scans use your Claude quota.')}</p>
    <label>{t('Özel Claude Yapıtı bağlantısı','Private Claude Artifact link')}
      <input type="url" value={link} onChange={event=>{
        const value = event.target.value
        setLink(value)
        setLocalArtifact(value)
      }}/>
    </label>
    {link && !url && <p role="alert">{t('Geçerli bir Claude Yapıtı bağlantısı girin.','Enter a valid Claude Artifact link.')}</p>}
    {!online ? <p role="status">{t('Claude taraması için internete bağlanın.','Connect to the internet to scan with Claude.')}</p> :
      <a className="button primary" href={url || 'https://claude.ai/login'} target="_blank" rel="noopener noreferrer">
        <ExternalLink/>{url ? t('Claude ile giriş yap ve tara','Sign in with Claude and scan') : t('Claude ile giriş yap','Sign in with Claude')}
      </a>}
    {!url && <p>{t('Taramayı açmak için hesabınızdaki Yapıt bağlantısını girin. Bağlantı bu cihazda saklanır.','Enter the Artifact link from your account to open scanning. The link is stored on this device.')}</p>}
  </section>
}

const choices:TransferChoice[]=['keep','incoming','merge','separate','skip']
export function ClaudeTransfer({t,notify,online,setup=false}:{t:Translate;notify:(message:string)=>void;online?:boolean;setup?:boolean}){
  const [connected,setConnected]=useState(navigator.onLine)
  useEffect(()=>{
    const change=()=>setConnected(navigator.onLine)
    window.addEventListener('online',change);window.addEventListener('offline',change)
    return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change)}
  },[])
  const [link,setLink]=useState(loadLink)
  const [text,setText]=useState('')
  const [preview,setPreview]=useState<{input:TransferInput;archive:Card[]}|null>(null)
  const [decisions,setDecisions]=useState(new Map<string,TransferDecision>())
  const [report,setReport]=useState<TransferReport>()
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const ready=online??connected
  const url=artifactUrl(link)
  function reset(){setPreview(null);setDecisions(new Map());setReport(undefined);setError('')}
  async function inspect(value:string){
    reset();setBusy(true)
    try{setPreview({input:inspectTransfer(value),archive:await cards.toArray()})}
    catch{setError(t('Aktarım okunamadı. Kartvizit v1 JSON biçimini, dosya boyutunu ve cihaz depolamasını kontrol edin.','Could not read the transfer. Check Kartvizit v1 JSON format, file size and device storage.'))}
    finally{setBusy(false)}
  }
  async function read(file?:File){
    if(!file)return
    reset();setText('')
    if(file.size>transferLimit){setError(t('Dosya 50 MB sınırını aşıyor.','File exceeds 50 MB.'));return}
    setBusy(true)
    try{await inspect(await file.text())}catch{setError(t('Dosya okunamadı.','Could not read file.'))}
    finally{setBusy(false)}
  }
  async function send(mode:'copy'|'download'|'share'){
    setBusy(true);setError('')
    try{
      const value=claudeExport(await cards.toArray())
      if(mode==='copy')await navigator.clipboard.writeText(value)
      else await deliver(new File([value],'kartvizit-claude.json',{type:'application/json'}),mode==='share')
      notify(t('Fotoğrafsız aktarım hazır.','Photo-free transfer ready.'))
    }catch{setError(t('Aktarım hazırlanamadı. Dosya indirmeyi deneyin.','Could not prepare transfer. Try downloading the file.'))}
    finally{setBusy(false)}
  }
  const plan=preview?planTransfer(preview.input,preview.archive,decisions):null
  const needsDecision=plan?.conflicts[0]
  async function save(){
    if(!preview||needsDecision)return
    setBusy(true);setError('')
    try{
      const r=await importClaudeTransfer(preview.input.cards,decisions,preview.input.invalid)
      setReport(r);setPreview(null);setText('');setDecisions(new Map())
    }catch{setError(t('Aktarım kaydedilemedi. Arşiv değiştiyse JSON’u tekrar inceleyin.','The transfer was not saved. If the archive changed, review the JSON again.'))}
    finally{setBusy(false)}
  }
  const fieldNames={firstName:t('Ad','First name'),lastName:t('Soyad','Last name'),fullName:t('Tam ad','Full name'),company:t('Şirket','Company'),department:t('Departman','Department'),jobTitle:t('Unvan','Title'),phoneNumbers:t('Telefon','Phone'),emailAddresses:t('E-posta','Email'),websites:t('Web','Websites'),socialLinks:t('Sosyal bağlantılar','Social links'),addresses:t('Adres','Addresses'),notes:t('Not','Notes'),tags:t('Etiket','Tags'),isFavorite:t('Favori','Favorite'),needsReview:t('İnceleme gerekli','Needs review')}
  const choiceName=(choice:TransferChoice)=>({
    keep:t('Mevcut kaydı koru','Keep existing'),incoming:t('Gelen kaydı kullan','Use incoming'),
    merge:t('Birleştir','Merge'),separate:t('Ayrı kayıt oluştur','Create separate card'),skip:t('Atla','Skip')
  }[choice])
  function summary(r:TransferReport){
    return t(`Toplam: ${r.total} · Eklenen: ${r.added} · Güncellenen: ${r.updated} · Atlanan: ${r.skipped} · Mükerrer: ${r.duplicates} · Çakışan: ${r.conflicts} · Geçersiz: ${r.invalid}`,
      `Total: ${r.total} · Added: ${r.added} · Updated: ${r.updated} · Skipped: ${r.skipped} · Duplicates: ${r.duplicates} · Conflicts: ${r.conflicts} · Invalid: ${r.invalid}`)
  }
  return <section className="panel screen-flow claude-transfer" aria-label={t('JSON aktarımı','JSON transfer')}>
    <h2>{t('JSON aktarımı','JSON transfer')}</h2>
    <p>{t('Kartvizit JSON v1 dosyalarını içe ve dışa aktarın. Aktarım cihazda yapılır.','Import and export Kartvizit JSON v1 files on your device.')}</p>
    {setup&&<details><summary>{t('Özel Artifact bağlantısı (isteğe bağlı)','Private Artifact link (optional)')}</summary>
      <label>{t('Claude Artifact bağlantısı','Claude Artifact link')}<input type="url" value={link} onChange={e=>{
        setLink(e.target.value)
        setLocalArtifact(e.target.value)
      }}/></label>
      {link&&!url&&<p role="alert">{t('Geçerli bir Claude Artifact bağlantısı girin.','Enter a valid Claude Artifact link.')}</p>}
    </details>}
    {!ready?<p role="status">{t('İnternet bağlantısı yok. JSON aktarımını kullanabilirsiniz.','No internet connection. JSON transfer is still available.')}</p>
      :url?<a className="button primary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink/>{t('Claude’da aç','Open in Claude')}</a>
      :null}
    <section className="screen-flow transfer-section">
    <h3>{t('JSON dışa aktar','Export JSON')}</h3>
    <p>{t('Bu aktarım sadece kart alanlarını içerir. Seçili kartlar için arşivin Dışa aktar menüsünü kullanın.','This transfer includes card fields only. For selected cards, use the archive Export menu.')}</p>
    <div className="actions"><button disabled={busy} onClick={()=>void send('download')}><Download/>{t('JSON indir','Download JSON')}</button><button disabled={busy} onClick={()=>void send('copy')}><Copy/>{t('JSON kopyala','Copy JSON')}</button>
      {typeof navigator.canShare==='function'&&<button disabled={busy} onClick={()=>void send('share')}><Share2/>{t('JSON paylaş','Share JSON')}</button>}</div>
    </section>
    <section className="screen-flow transfer-section">
    <h3>{t('JSON içe aktar','Import JSON')}</h3>
    <label className="button file-button"><Upload/>{t('JSON dosyası seç','Choose JSON file')}<input disabled={busy} type="file" accept=".json,application/json" aria-label={t('Kartvizit JSON dosyası','Kartvizit JSON file')} onChange={e=>{void read(e.target.files?.[0]);e.target.value=''}}/></label>
    <label>{t('Veya JSON yapıştır','Or paste JSON')}<textarea disabled={busy} rows={4} value={text} onChange={e=>{setText(e.target.value);reset()}}/></label>
    <button disabled={busy||!text.trim()} onClick={()=>void inspect(text)}>{t('Aktarımı kontrol et','Validate transfer')}</button>
    {preview&&plan&&<div className="screen-flow"><p className="scan-status" role="status">{t('Önizleme: ','Preview: ')}{summary(plan.report)}. {t('Silmeler aktarılmaz.','Deletions are not transferred.')}</p>
      <ul>{preview.input.cards.slice(0,10).map(c=><li key={c.id}>{labelOf(c)||c.emailAddresses[0]||c.id}</li>)}</ul>
      {needsDecision&&<div className="notice screen-flow" key={needsDecision.incoming.id}><p role="alert"><strong>{t('Kartvizit çakışması','Card conflict')}</strong> {t('Aktarmadan önce mevcut ve gelen kaydı karşılaştırıp bir karar seçin.','Compare the existing and incoming cards and choose how to resolve the conflict before importing.')}</p>
        <p>{t('Gelen','Incoming')}: {labelOf(needsDecision.incoming)||needsDecision.incoming.id} · {needsDecision.incoming.company} · {needsDecision.incoming.updatedAt} · {needsDecision.incoming.emailAddresses.join(', ')} · {needsDecision.incoming.phoneNumbers.map(p=>p.number).join(', ')}</p>
        {needsDecision.existing.map(c=><div className="screen-flow" key={c.id}><p>{t('Mevcut','Existing')}: {labelOf(c)||c.id} · {c.company} · {c.updatedAt} · {c.emailAddresses.join(', ')} · {c.phoneNumbers.map(p=>p.number).join(', ')}</p>
          <details><summary>{t('Değişen alanları göster','Show changed fields')}</summary>
            <ul>{compareContact(c,needsDecision.incoming).map(change=><li key={change.field}><strong>{fieldNames[change.field]}:</strong> {change.existing||'—'} → {change.incoming||'—'}</li>)}</ul>
          </details>
          <label>{t('Karar','Decision')}<select aria-label={t('Karar','Decision')} value="" disabled={busy} onChange={e=>{const choice=e.target.value as TransferChoice;if(choices.includes(choice))setDecisions(old=>new Map(old).set(needsDecision.incoming.id,{choice,targetId:c.id,targetState:transferState(c),separateId:crypto.randomUUID()}))}}>
            <option value="">{t('Seçin','Choose')}</option>{choices.map(option=><option key={option} value={option}>{choiceName(option)}</option>)}
          </select></label>
        </div>)}
        {!!decisions.size&&<button disabled={busy} onClick={()=>setDecisions(new Map())}>{t('Kararları sıfırla','Reset decisions')}</button>}
      </div>}
      <div className="actions"><button className="primary" disabled={busy||!!needsDecision||!preview.input.cards.length} onClick={()=>void save()}>{t('Arşive aktar','Import into archive')}</button><button disabled={busy} onClick={reset}>{t('İptal','Cancel')}</button></div>
    </div>}
    {report&&<p className="scan-status" data-state="ready" role="status">{summary(report)}</p>}
    {error&&<p className="notice" role="alert">{error}</p>}
    </section>
  </section>
}
