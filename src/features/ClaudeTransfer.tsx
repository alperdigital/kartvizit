import {useEffect,useState} from 'react'
import {Download, Upload, ExternalLink, Copy, Share2} from 'lucide-react'
import {cards,labelOf, type Card} from '../services/cards'
import {deliver} from '../services/export'
import {claudeExport,inspectTransfer,importClaudeTransfer,planTransfer,transferLimit,transferState,type TransferChoice,type TransferDecision,type TransferInput,type TransferReport} from '../services/claude-transfer'
import type {Translate} from '../i18n'

const defaultLink=import.meta.env.VITE_CLAUDE_ARTIFACT_URL as string|undefined
const linkKey='kartvizit-claude-artifact'
const obsoleteExample='https://claude.ai/artifact/5aZ3uLS5ZtFxYkCj8Cqnzi'
function loadLink(){
  try{
    const override=localStorage.getItem(linkKey)
    return override && override!==obsoleteExample ? override : defaultLink||''
  }catch{return defaultLink||''}
}
export function artifactUrl(value:string){
  try{
    const url=new URL(value)
    return ['https://claude.ai','https://claude.com'].includes(url.origin) && /^\/(artifact|artifacts|public\/artifacts)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
      && !url.username && !url.password && !url.search && !url.hash && url.href.replace(/\/$/,'')!==obsoleteExample ? url.href : undefined
  }catch{return undefined}
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
  const choiceName=(choice:TransferChoice)=>({
    keep:t('Mevcut kaydı koru','Keep existing'),incoming:t('Gelen kaydı kullan','Use incoming'),
    merge:t('Birleştir','Merge'),separate:t('Ayrı kayıt oluştur','Create separate card'),skip:t('Atla','Skip')
  }[choice])
  function summary(r:TransferReport){
    return t(`Toplam: ${r.total} · Eklenen: ${r.added} · Güncellenen: ${r.updated} · Atlanan: ${r.skipped} · Mükerrer: ${r.duplicates} · Çakışan: ${r.conflicts} · Geçersiz: ${r.invalid}`,
      `Total: ${r.total} · Added: ${r.added} · Updated: ${r.updated} · Skipped: ${r.skipped} · Duplicates: ${r.duplicates} · Conflicts: ${r.conflicts} · Invalid: ${r.invalid}`)
  }
  return <section className="panel screen-flow claude-transfer" aria-label={t('Claude aktarımı','Claude transfer')}>
    <h2>{t('Claude ile kartvizit okuma','Scan with Claude')}</h2>
    <p>{t('Claude için internet ve Claude hesabı gerekir. Giriş Claude’da yapılır. Arşivler otomatik eşitlenmez.','Claude requires internet and a Claude account. Sign-in happens in Claude. Archives never sync automatically.')}</p>
    {setup&&<details><summary>{t('Özel Artifact bağlantısı (isteğe bağlı)','Private Artifact link (optional)')}</summary>
      <label>{t('Claude Artifact bağlantısı','Claude Artifact link')}<input type="url" value={link} onChange={e=>{
        setLink(e.target.value)
        try{localStorage.setItem(linkKey,e.target.value)}catch{/* optional preference */}
      }}/></label>
      {link&&!url&&<p role="alert">{t('Geçerli bir Claude Artifact bağlantısı girin.','Enter a valid Claude Artifact link.')}</p>}
    </details>}
    {!ready?<p role="status">{t('İnternet bağlantısı yok. Cihazda Tara veya manuel JSON aktarımını kullanabilirsiniz.','No internet connection. Use on-device scanning or manual JSON transfer.')}</p>
      :url?<a className="button primary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink/>{t('Claude’da aç','Open in Claude')}</a>
      :<p role="status">{t('Artifact bağlantısı henüz yapılandırılmadı. JSON aktarımı kullanılabilir.','The Artifact link is not configured yet. JSON transfer is available.')}</p>}
    <h3>{t('Claude’a aktar','Transfer to Claude')}</h3>
    <p>{t('Tüm kartların ayrıştırılmış bilgileri aktarılır; fotoğraf ve ham OCR metni dahil edilmez. Seçili kartlar için arşivin Dışa aktar menüsünü kullanın.','Transfer structured data for all cards without photos or raw OCR. For selected cards, use the archive Export menu.')}</p>
    <div className="actions"><button disabled={busy} onClick={()=>void send('download')}><Download/>{t('JSON indir','Download JSON')}</button><button disabled={busy} onClick={()=>void send('copy')}><Copy/>{t('JSON kopyala','Copy JSON')}</button>
      {typeof navigator.canShare==='function'&&<button disabled={busy} onClick={()=>void send('share')}><Share2/>{t('JSON paylaş','Share JSON')}</button>}</div>
    <h3>{t('Claude’dan aktar','Import from Claude')}</h3>
    <label className="button file-button"><Upload/>{t('JSON dosyası seç','Choose JSON file')}<input disabled={busy} type="file" accept=".json,application/json" aria-label={t('Claude JSON dosyası','Claude JSON file')} onChange={e=>{void read(e.target.files?.[0]);e.target.value=''}}/></label>
    <label>{t('Veya JSON yapıştır','Or paste JSON')}<textarea disabled={busy} rows={4} value={text} onChange={e=>{setText(e.target.value);reset()}}/></label>
    <button disabled={busy||!text.trim()} onClick={()=>void inspect(text)}>{t('Aktarımı kontrol et','Validate transfer')}</button>
    {preview&&plan&&<div className="screen-flow"><p role="status">{t('Önizleme: ','Preview: ')}{summary(plan.report)}. {t('Silmeler aktarılmaz.','Deletions are not transferred.')}</p>
      <ul>{preview.input.cards.slice(0,10).map(c=><li key={c.id}>{labelOf(c)||c.emailAddresses[0]||c.id}</li>)}</ul>
      {needsDecision&&<div className="notice screen-flow" key={needsDecision.incoming.id}><strong>{t('Çakışmayı inceleyin','Review conflict')}</strong>
        <p>{t('Gelen','Incoming')}: {labelOf(needsDecision.incoming)||needsDecision.incoming.id} · {needsDecision.incoming.company} · {needsDecision.incoming.updatedAt} · {needsDecision.incoming.emailAddresses.join(', ')} · {needsDecision.incoming.phoneNumbers.map(p=>p.number).join(', ')}</p>
        {needsDecision.existing.map(c=><div className="screen-flow" key={c.id}><p>{t('Mevcut','Existing')}: {labelOf(c)||c.id} · {c.company} · {c.updatedAt} · {c.emailAddresses.join(', ')} · {c.phoneNumbers.map(p=>p.number).join(', ')}</p>
          <label>{t('Karar','Decision')}<select value="" disabled={busy} onChange={e=>{const choice=e.target.value as TransferChoice;if(choices.includes(choice))setDecisions(old=>new Map(old).set(needsDecision.incoming.id,{choice,targetId:c.id,targetState:transferState(c),separateId:crypto.randomUUID()}))}}>
            <option value="">{t('Seçin','Choose')}</option>{choices.map(option=><option key={option} value={option}>{choiceName(option)}</option>)}
          </select></label>
        </div>)}
        {!!decisions.size&&<button disabled={busy} onClick={()=>setDecisions(new Map())}>{t('Kararları sıfırla','Reset decisions')}</button>}
      </div>}
      <div className="actions"><button className="primary" disabled={busy||!!needsDecision||!preview.input.cards.length} onClick={()=>void save()}>{t('Arşive aktar','Import into archive')}</button><button disabled={busy} onClick={reset}>{t('İptal','Cancel')}</button></div>
    </div>}
    {report&&<p role="status">{summary(report)}</p>}
    {error&&<p role="alert">{error}</p>}
  </section>
}
