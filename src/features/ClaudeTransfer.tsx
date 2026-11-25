import {useState} from 'react'
import {Download, Upload, ExternalLink, Copy} from 'lucide-react'
import {cards,type Card} from '../services/cards'
import {deliver} from '../services/export'
import {claudeExport,parseClaudeTransfer,importClaudeTransfer} from '../services/claude-transfer'
import type {Translate} from '../i18n'

const defaultLink='https://claude.ai/artifact/5aZ3uLS5ZtFxYkCj8Cqnzi'
function loadLink(){
  try{return localStorage.getItem('kartvizit-claude-artifact')||defaultLink}catch{return defaultLink}
}
function artifactUrl(value:string){
  try{
    const url=new URL(value)
    return url.origin==='https://claude.ai' && /^\/(artifact|artifacts|public\/artifacts)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
      && !url.username && !url.password ? url.href : undefined
  }catch{return undefined}
}
export function ClaudeTransfer({t,notify}:{t:Translate;notify:(message:string)=>void}){
  const [link,setLink]=useState(loadLink)
  const [text,setText]=useState('')
  const [preview,setPreview]=useState<Card[]|null>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  function inspect(value:string){
    setPreview(null);setError('')
    try{setPreview(parseClaudeTransfer(value))}
    catch{setError(t('Geçersiz Kartvizit JSON dosyası. Claude tarafında uyumlu aktarım biçimi kullanın.','Invalid Kartvizit JSON. Use the compatible transfer format in Claude.'))}
  }
  async function read(file?:File){
    if(!file)return
    setPreview(null);setError('');setText('')
    if(file.size>50*1024*1024){setError(t('Dosya 50 MB sınırını aşıyor.','File exceeds 50 MB.'));return}
    setBusy(true)
    try{inspect(await file.text())}catch{setError(t('Dosya okunamadı.','Could not read file.'))}
    finally{setBusy(false)}
  }
  async function send(copy:boolean){
    setBusy(true);setError('')
    try{
      const value=claudeExport(await cards.toArray())
      if(copy)await navigator.clipboard.writeText(value)
      else await deliver(new File([value],'kartvizit-claude.json',{type:'application/json'}))
      notify(t('Fotoğrafsız aktarım hazır.','Photo-free transfer ready.'))
    }catch{setError(t('Aktarım hazırlanamadı. Dosya indirmeyi deneyin.','Could not prepare transfer. Try downloading the file.'))}
    finally{setBusy(false)}
  }
  async function save(){
    if(!preview)return
    setBusy(true);setError('')
    try{
      const r=await importClaudeTransfer(preview)
      notify(t(`${r.added} eklendi, ${r.updated} güncellendi, ${r.skipped} atlandı, ${r.conflicts} çakışma korundu.`,`${r.added} added, ${r.updated} updated, ${r.skipped} skipped, ${r.conflicts} conflicts preserved.`))
      setPreview(null);setText('')
    }catch{setError(t('Aktarım kaydedilemedi.','Could not save transfer.'))}
    finally{setBusy(false)}
  }
  const url=artifactUrl(link)
  return <section className="panel screen-flow" aria-label={t('Claude aktarımı','Claude transfer')}>
    <h2>{t('Claude ile kartvizit okuma','Scan with Claude')}</h2>
    <p>{t('Claude kendi hesabınızda çalışır. API anahtarı gerekmez. Arşivler otomatik eşitlenmez; JSON ile aktarılır.','Claude runs in your own account. No API key is needed. Archives do not sync automatically; transfer them with JSON.')}</p>
    <label>{t('Claude Artifact bağlantısı','Claude Artifact link')}<input type="url" value={link} onChange={e=>{
      setLink(e.target.value)
      try{localStorage.setItem('kartvizit-claude-artifact',e.target.value)}catch{/* optional preference */}
    }}/></label>
    {!url&&<p role="alert">{t('Geçerli bir Claude Artifact bağlantısı girin.','Enter a valid Claude Artifact link.')}</p>}
    <div className="actions">
      {url&&<a className="button" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink/>{t('Claude’da aç','Open in Claude')}</a>}
      <a className="button" href={import.meta.env.BASE_URL+'claude-artifact-prompt.txt'} download>{t('Artifact kurulum talimatı','Artifact setup instructions')}</a>
    </div>
    <p>{t('İlk kullanımda uyumlu Artifact oluşturun veya mevcut olanı kurulum talimatıyla güncelleyin. Claude tarafında kişisel depolama seçin.','First create a compatible Artifact or update your existing one using the setup instructions. Use personal storage in Claude.')}</p>
    <h3>{t('Claude’a aktar','Transfer to Claude')}</h3>
    <p>{t('Yalnızca ayrıştırılmış kartvizitler aktarılır; fotoğraf ve ham OCR metni dahil edilmez.','Only structured cards are transferred; photos and raw OCR text are excluded.')}</p>
    <div className="actions"><button disabled={busy} onClick={()=>void send(false)}><Download/>{t('JSON indir','Download JSON')}</button><button disabled={busy} onClick={()=>void send(true)}><Copy/>{t('JSON kopyala','Copy JSON')}</button></div>
    <h3>{t('Claude’dan aktar','Import from Claude')}</h3>
    <label className="button file-button"><Upload/>{t('JSON dosyası seç','Choose JSON file')}<input disabled={busy} type="file" accept=".json,application/json" aria-label={t('Claude JSON dosyası','Claude JSON file')} onChange={e=>{void read(e.target.files?.[0]);e.target.value=''}}/></label>
    <label>{t('Veya JSON yapıştır','Or paste JSON')}<textarea rows={4} value={text} onChange={e=>{setText(e.target.value);setPreview(null);setError('')}}/></label>
    <button disabled={busy||!text.trim()} onClick={()=>inspect(text)}>{t('Aktarımı kontrol et','Validate transfer')}</button>
    {preview&&<div className="screen-flow"><p role="status">{t(`${preview.length} geçerli kartvizit. Aynı kimlikli daha yeni kayıtlar güncellenir; farklı kimlikli benzer kayıtlar korunur ve atlanır. Silmeler aktarılmaz.`,`${preview.length} valid cards. Newer records with the same ID update; similar records with different IDs are preserved and skipped. Deletions are not transferred.`)}</p><ul>{preview.slice(0,10).map(c=><li key={c.id}>{c.fullName||c.company||c.emailAddresses[0]||c.id}</li>)}</ul><div className="actions"><button disabled={busy} onClick={()=>void save()}>{t('Arşive aktar','Import into archive')}</button><button disabled={busy} onClick={()=>setPreview(null)}>{t('İptal','Cancel')}</button></div></div>}
    {error&&<p role="alert">{error}</p>}
  </section>
}
