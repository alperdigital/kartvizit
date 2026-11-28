import {useEffect,useRef,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {cardSchema,labelOf,matches,newCard,type Card} from '../../src/services/card-contract'
import {clipboardTable,csv,deliver} from '../../src/services/file-contract'
import {claudeExport,compareContact,inspectTransfer,planTransfer,transferState,transferLimit,type TransferChoice,type TransferDecision,type TransferInput} from '../../src/services/transfer-contract'
import {createArchive,extractionDrafts,extractionPrompt,type ClaudeImagePort,type PersonalPort} from './providers'
import './artifact.css'

type Ports={vision?:ClaudeImagePort;personal?:PersonalPort}
type Side={file:File;rotation:number;margin:number}
type PhotoCard={id:string;front:Side;back?:Side}
type Draft={card:Card;uncertain:string[];edit?:boolean}
const fileTypes=['image/jpeg','image/png','image/webp']
const accept=fileTypes.join(',')
const valid=(f:File)=>fileTypes.includes(f.type)&&f.size>0&&f.size<=20*1024*1024
const photo=(file:File):Side=>({file,rotation:0,margin:0})
const name=(c:Card)=>labelOf(c)||c.emailAddresses[0]||c.phoneNumbers[0]?.number||c.id

function Preview({side,label,change}:{side:Side;label:string;change:(side:Side)=>void}){
  const [url,setUrl]=useState('')
  useEffect(()=>{const next=URL.createObjectURL(side.file);setUrl(next);return()=>URL.revokeObjectURL(next)},[side.file])
  return <figure>{url&&<img src={url} alt={label} style={{transform:'rotate('+side.rotation+'deg) scale('+1/(1-side.margin*2)+')'}}/>}
    <figcaption>{label} · {side.file.name}</figcaption>
    <button type="button" onClick={()=>change({...side,rotation:(side.rotation+90)%360})}>↻ {label}</button>
    <label>{label} ± % <input type="range" min={0} max={25} value={side.margin*100} onChange={e=>change({...side,margin:Number(e.target.value)/100})}/></label>
  </figure>
}
async function prepare(side:Side){
  const bitmap=await createImageBitmap(side.file)
  try{
    const w=bitmap.width*(1-side.margin*2),h=bitmap.height*(1-side.margin*2),scale=Math.min(1,1600/Math.max(w,h))
    const canvas=document.createElement('canvas')
    const swapped=side.rotation%180!==0
    canvas.width=Math.max(1,Math.round((swapped?h:w)*scale))
    canvas.height=Math.max(1,Math.round((swapped?w:h)*scale))
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('Canvas unavailable')
    ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(side.rotation*Math.PI/180)
    ctx.fillStyle='white';ctx.fillRect(-w*scale/2,-h*scale/2,w*scale,h*scale)
    ctx.drawImage(bitmap,bitmap.width*side.margin,bitmap.height*side.margin,w,h,-w*scale/2,-h*scale/2,w*scale,h*scale)
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image encoding failed')),'image/jpeg',.88))
  }finally{bitmap.close()}
}

export function App({ports={}}:{ports?:Ports}){
  const [archive]=useState(()=>createArchive(ports.personal))
  const [cards,setCards]=useState<Card[]>([])
  const [photos,setPhotos]=useState<PhotoCard[]>([])
  const [drafts,setDrafts]=useState<Draft[]>([])
  const [transfer,setTransfer]=useState<TransferInput>()
  const [pendingEdit,setPendingEdit]=useState<Card>()
  const [decisions,setDecisions]=useState(new Map<string,TransferDecision>())
  const [pane,setPane]=useState<'scan'|'archive'|'transfer'>('scan')
  const [lang,setLang]=useState<'tr'|'en'>('tr')
  const [dark,setDark]=useState(false)
  const [query,setQuery]=useState('')
  const [tag,setTag]=useState('')
  const [favorites,setFavorites]=useState(false)
  const [modelText,setModelText]=useState('')
  const [json,setJson]=useState('')
  const [progress,setProgress]=useState('')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [working,setWorking]=useState(false)
  const [ready,setReady]=useState(!archive.persistent)
  const abort=useRef<AbortController|null>(null)
  const t=(tr:string,en:string)=>lang==='tr'?tr:en
  useEffect(()=>{let active=true;void archive.load().then(data=>{if(active){setCards(data);setReady(true)}}).catch(()=>{if(active)setError('Personal Storage / Kişisel depolama açılamadı.')});return()=>{active=false;abort.current?.abort()}},[archive])
  useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dataset.theme=dark?'dark':'light'},[dark,lang])
  const status=archive.persistent?(ready?t('Kişisel depolama','Personal storage'):t('Kişisel depolama açılamadı','Personal storage could not open')):t('Geçici oturum · Kapatmadan önce JSON indirin','Temporary session · Download JSON before closing')
  async function update(next:Card[]){
    if(!ready||working)return false
    setWorking(true);setError('')
    try{setCards(await archive.save(next));return true}
    catch{setError(t('Yazım doğrulanamadı. Tekrar denemeden önce arşivi kontrol edin.','The write could not be verified. Check the archive before retrying.'));return false}
    finally{setWorking(false)}
  }
  async function copy(value:string){
    setError('')
    try{await navigator.clipboard.writeText(value);setMessage(t('Panoya kopyalandı.','Copied to clipboard.'))}
    catch{setError(t('Pano kullanılamıyor; dosya indirmeyi deneyin.','Clipboard unavailable; try downloading the file.'))}
  }
  function addPhotos(files:FileList|null){
    if(!files)return
    const chosen=[...files];setError(chosen.some(f=>!valid(f))?t('Yalnızca 20 MB’a kadar JPEG, PNG ve WebP yükleyin.','Use JPEG, PNG or WebP files up to 20 MB.'):'')
    setPhotos(old=>[...old,...chosen.filter(valid).map(f=>({id:crypto.randomUUID(),front:photo(f)}))].slice(0,10))
  }
  function changePhoto(id:string,values:Partial<PhotoCard>){setPhotos(old=>old.map(p=>p.id===id?{...p,...values}:p))}
  function loadResult(){
    try{setDrafts(old=>[...old,...extractionDrafts(modelText)]);setModelText('');setError('')}
    catch{setError(t('AI sonucu geçerli kartvizit JSON’u değil.','The AI response is not valid business-card JSON.'))}
  }
  async function analyze(){
    if(!ports.vision||working||!photos.length)return
    const vision=ports.vision
    const controller=new AbortController()
    abort.current=controller;setWorking(true);setError('')
    const result:Draft[]=[]
    try{
      for(const [i,input] of photos.entries()){
        if(controller.signal.aborted)break
        setProgress((i+1)+' / '+photos.length)
        const images=await Promise.all([input.front,...(input.back?[input.back]:[])].map(prepare))
        if(controller.signal.aborted)break
        const output=await vision(images,extractionPrompt,controller.signal)
        if(controller.signal.aborted)break
        result.push(...extractionDrafts(output))
      }
      if(!controller.signal.aborted){setDrafts(old=>[...old,...result]);setPhotos([]);setMessage(t('Tarama tamamlandı. Kaydetmeden önce kontrol edin.','Scan complete. Review before saving.'))}
    }catch{if(!controller.signal.aborted)setError(t('Claude taraması tamamlanamadı. İzinleri, kotayı ve bağlantıyı kontrol edip yeniden deneyin.','Claude scan failed. Check permissions, quota and connectivity, then retry.'))}
    finally{abort.current=null;setProgress('');setWorking(false)}
  }
  function inspect(value:string){
    setError('');setTransfer(undefined);setPendingEdit(undefined);setDecisions(new Map())
    try{setTransfer(inspectTransfer(value))}catch{setError(t('Geçersiz Kartvizit v1 JSON.','Invalid Kartvizit v1 JSON.'))}
  }
  async function readTransfer(f?:File){
    if(!f)return
    if(f.size>transferLimit){setError(t('Dosya 50 MB sınırını aşıyor.','File exceeds 50 MB.'));return}
    try{const value=await f.text();inspect(value)}catch{setError(t('Dosya okunamadı.','Could not read the file.'))}
  }
  const plan=transfer?planTransfer(transfer,cards,decisions):undefined
  const conflict=plan?.conflicts[0]
  const choiceNames={keep:t('Mevcut kaydı koru','Keep existing'),incoming:t('Gelen kaydı kullan','Use incoming'),merge:t('Birleştir','Merge'),separate:t('Ayrı kayıt oluştur','Create separate card'),skip:t('Atla','Skip')}
  const description=(r:NonNullable<typeof plan>['report'])=>t(`Toplam ${r.total} · Eklenen ${r.added} · Güncellenen ${r.updated} · Atlanan ${r.skipped} · Mükerrer ${r.duplicates} · Çakışan ${r.conflicts} · Geçersiz ${r.invalid}`,`Total ${r.total} · Added ${r.added} · Updated ${r.updated} · Skipped ${r.skipped} · Duplicates ${r.duplicates} · Conflicts ${r.conflicts} · Invalid ${r.invalid}`)
  async function commit(){
    if(!plan||conflict)return
    const next=new Map(cards.map(c=>[c.id,c]))
    plan.changes.forEach(c=>next.set(c.id,c))
    if(await update([...next.values()])){setMessage(description(plan.report));setTransfer(undefined);setJson('');setDecisions(new Map())}
  }
  const shown=cards.filter(c=>matches(c,query)&&(!tag||c.tags.includes(tag))&&(!favorites||c.isFavorite))
  function queue(draft:Card,edit=false){
    const result=cardSchema.safeParse(draft)
    if(!result.success){setError(t('Kartvizit alanlarını kontrol edin.','Check the business-card fields.'));return}
    if(!labelOf(draft)&&!draft.emailAddresses.length&&!draft.phoneNumbers.length){setError(t('En az ad, şirket, e-posta veya telefon girin.','Enter at least a name, company, email or phone.'));return}
    if(edit){setPendingEdit(result.data);setTransfer(undefined)}
    else{setPendingEdit(undefined);setTransfer({cards:[result.data],invalid:0})}
    setDecisions(new Map());setError('');setPane('transfer')
    setDrafts(old=>old.filter(d=>d.card.id!==draft.id))
  }
  async function download(value:string,filename:string,type:string){try{await deliver(new File([value],filename,{type}))}catch{setError(t('Dosya indirilemedi.','Download failed.'))}}
  return <main>
    <header><div><h1>{t('Kartvizit çalışma alanı','Business card workspace')}</h1><p>{status}</p></div>
      <div className="actions"><button onClick={()=>setLang(lang==='tr'?'en':'tr')} aria-label={t('Switch to English','Türkçeye geç')}>{lang==='tr'?'EN':'TR'}</button><button onClick={()=>setDark(!dark)} aria-pressed={dark}>{t('Koyu tema','Dark mode')}</button></div></header>
    <nav aria-label={t('Çalışma alanı','Workspace')}>{(['scan','archive','transfer'] as const).map(key=><button key={key} aria-current={pane===key?'page':undefined} onClick={()=>{setPane(key);setMessage('');setError('')}}>{({scan:t('Tara','Scan'),archive:t('Arşiv','Archive'),transfer:t('JSON aktarımı','JSON transfer')})[key]}</button>)}</nav>
    {message&&<p role="status" className="notice">{message}</p>}{error&&<p role="alert" className="notice error">{error}</p>}
    {pane==='scan'&&<section>
      <h2>{t('Kartvizit tara','Scan a business card')}</h2>
      {ports.vision?<><p>{t('Görseller yalnızca analiz için Claude’a gönderilir; arşive yazılmaz.','Images are sent to Claude only for analysis; they are not written to the archive.')}</p>
      <div className="actions"><label>{t('Galeriden seç','Choose photos')}<input type="file" accept={accept} multiple disabled={working} onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/></label><label>{t('Kamera','Camera')}<input type="file" accept={accept} capture="environment" disabled={working} onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/></label></div>
      <fieldset disabled={working}><legend>{t('Ön ve arka yüz · En fazla 10 kart','Front and back · Up to 10 cards')}</legend>{photos.map(p=><article key={p.id}><Preview side={p.front} label={t('Ön yüz','Front')} change={front=>changePhoto(p.id,{front})}/>
      {p.back&&<Preview side={p.back} label={t('Arka yüz','Back')} change={back=>changePhoto(p.id,{back})}/>}
      <label>{t('Arka yüz seç','Choose back')}<input type="file" accept={accept} onChange={e=>{const f=e.target.files?.[0];if(f&&valid(f))changePhoto(p.id,{back:photo(f)});else if(f)setError(t('Desteklenmeyen görsel.','Unsupported image.'))}}/></label>
      <button onClick={()=>setPhotos(old=>old.filter(item=>item.id!==p.id))}>{t('Görseli kaldır','Remove image')}</button></article>)}</fieldset>
      <div className="actions"><button disabled={working||!photos.length} onClick={()=>void analyze()}>{t('Claude ile analiz et','Analyze with Claude')}</button>{abort.current&&<button onClick={()=>{abort.current?.abort();setPhotos([]);setProgress(t('İptal ediliyor','Canceling'))}}>{t('Taramayı iptal et','Cancel scan')}</button>}</div>{progress&&<p role="status">{progress}</p>}</>:
      <><p className="notice">{t('Bu çalıştırma ortamında Artifact içi görsel analizi bağlı değil. Alternatif olarak Claude sohbetinde görselleri analiz edip sonucu buraya yapıştırabilirsiniz.','In-Artifact vision is not connected in this environment. Instead, analyze the images in Claude chat and paste the result here.')}</p>
      <button onClick={()=>void copy(extractionPrompt)}>{t('Sohbet için analiz talimatını kopyala','Copy analysis prompt for Claude chat')}</button><details><summary>{t('Analiz talimatını göster','Show analysis prompt')}</summary><p>{extractionPrompt}</p></details>
      <label>{t('Claude analiz JSON’u','Claude analysis JSON')}<textarea rows={4} value={modelText} onChange={e=>setModelText(e.target.value)}/></label><button disabled={!modelText.trim()} onClick={loadResult}>{t('Sonucu incele','Review result')}</button></>}
      <button onClick={()=>setDrafts(old=>[...old,{card:newCard(),uncertain:[]}])}>{t('Manuel taslak','Manual draft')}</button>
      {drafts.map(d=><DraftForm key={d.card.id} draft={d} t={t} review={card=>queue(card,d.edit)}/>)}
    </section>}
    {pane==='archive'&&<section><h2>{t('Kişisel arşiv','Personal archive')}</h2>
      <label>{t('Kart ara','Search cards')}<input type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <label>{t('Etiket','Tag')}<select value={tag} onChange={e=>setTag(e.target.value)}><option value="">{t('Tümü','All')}</option>{[...new Set(cards.flatMap(c=>c.tags))].sort().map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="inline"><input type="checkbox" checked={favorites} onChange={e=>setFavorites(e.target.checked)}/>{t('Yalnızca favoriler','Favorites only')}</label>
      {!shown.length&&<p>{t('Gösterilecek kart yok.','No cards to show.')}</p>}
      {shown.map(c=><article key={c.id}><strong>{name(c)}</strong><p>{[c.company,c.jobTitle,...c.emailAddresses].filter(Boolean).join(' · ')}</p>
        <div className="actions"><button disabled={working||!ready} aria-pressed={c.isFavorite} onClick={()=>void update(cards.map(old=>old.id===c.id?{...c,isFavorite:!c.isFavorite,updatedAt:new Date().toISOString()}:old))}>★ {t('Favori','Favorite')}</button>
        <button onClick={()=>{setDrafts(old=>[...old.filter(d=>d.card.id!==c.id),{card:c,uncertain:[],edit:true}]);setPane('scan')}}>{t('Düzenle','Edit')}</button>
        <button disabled={working||!ready} onClick={()=>{if(window.confirm(t('Kart silinsin mi?','Delete this card?')))void update(cards.filter(old=>old.id!==c.id))}}>{t('Sil','Delete')}</button></div></article>)}
      <div className="actions"><button onClick={()=>void download(csv(shown),'kartvizit.csv','text/csv')}>CSV</button><button onClick={()=>void copy(clipboardTable(shown))}>{t('Tabloyu kopyala','Copy table')}</button></div>
    </section>}
    {pane==='transfer'&&<section><h2>{t('Manuel JSON aktarımı','Manual JSON transfer')}</h2>
      <p>{t('Fotoğraf ve ham OCR aktarılmaz. Silmeler karşı tarafa yansımaz.','Photos and raw OCR are excluded. Deletions do not propagate.')}</p>
      <div className="actions"><button onClick={()=>void download(claudeExport(cards),'kartvizit-claude.json','application/json')}>{t('JSON indir','Download JSON')}</button><button onClick={()=>void copy(claudeExport(cards))}>{t('JSON kopyala','Copy JSON')}</button></div>
      <label>{t('JSON dosyası','JSON file')}<input type="file" accept=".json,application/json" disabled={working} onChange={e=>{void readTransfer(e.target.files?.[0]);e.target.value=''}}/></label>
      <label>{t('JSON yapıştır','Paste JSON')}<textarea value={json} disabled={working} rows={4} onChange={e=>{setJson(e.target.value);setTransfer(undefined)}}/></label>
      <button disabled={working||!json.trim()} onClick={()=>inspect(json)}>{t('Aktarımı incele','Review transfer')}</button>
      {pendingEdit&&<article><h3>{t('Yerel düzenlemeyi onaylayın','Confirm archive edit')}</h3><p>{name(pendingEdit)} · {pendingEdit.company}</p>
        <div className="actions"><button disabled={!ready||working} onClick={()=>void update(cards.map(c=>c.id===pendingEdit.id?pendingEdit:c)).then(ok=>{if(ok){setPendingEdit(undefined);setPane('archive');setMessage(t('Kartvizit kaydedildi.','Card saved.'))}})}>{t('Düzenlemeyi kaydet','Save changes')}</button>
        <button disabled={working} onClick={()=>setPendingEdit(undefined)}>{t('İptal','Cancel')}</button></div>
      </article>}
      {plan&&<article><p role="status">{description(plan.report)}</p>{transfer?.cards.slice(0,10).map(c=><p key={c.id}>{name(c)}</p>)}
        {conflict&&<div key={conflict.incoming.id}><h3>{t('Çakışmayı inceleyin','Review conflict')}</h3>
          <p>{t('Gelen','Incoming')}: {name(conflict.incoming)} · {conflict.incoming.company} · {conflict.incoming.updatedAt}</p>
          {conflict.existing.map(c=><label key={c.id}>{t('Mevcut','Existing')}: {name(c)} · {c.company} · {c.updatedAt}
          <span>{compareContact(c,conflict.incoming).map(change=>(change.existing||'—')+' → '+(change.incoming||'—')).join(' / ')}</span>
          <select aria-label={t('Karar','Decision')} value="" onChange={e=>{const choice=e.target.value as TransferChoice;if(choice in choiceNames)setDecisions(old=>new Map(old).set(conflict.incoming.id,{choice,targetId:c.id,targetState:transferState(c),separateId:crypto.randomUUID()}))}}>
            <option value="">{t('Karar seçin','Choose decision')}</option>{Object.entries(choiceNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select></label>)}</div>}
        <div className="actions"><button disabled={!ready||working||!!conflict||!transfer?.cards.length} onClick={()=>void commit()}>{t('Arşive kaydet','Save to archive')}</button><button disabled={working} onClick={()=>{setTransfer(undefined);setDecisions(new Map())}}>{t('İptal','Cancel')}</button></div>
      </article>}
    </section>}
    <footer><a href="https://duayenalper.github.io/kartvizit/" target="_blank" rel="noopener noreferrer">{t('Kartvizit PWA’ya dön','Return to Kartvizit PWA')} ↗</a></footer>
  </main>
}

function DraftForm({draft,t,review}:{draft:Draft;t:(tr:string,en:string)=>string;review:(card:Card)=>void}){
  const [card,setCard]=useState(draft.card)
  const [invalid,setInvalid]=useState(false)
  const fields=[['firstName',t('Ad','First name')],['lastName',t('Soyad','Last name')],['fullName',t('Tam ad','Full name')],['company',t('Şirket','Company')],['department',t('Departman','Department')],['jobTitle',t('Unvan','Title')],['notes',t('Not','Notes')]] as const
  const lists=[['emailAddresses',t('E-postalar','Email addresses')],['websites',t('Web siteleri','Websites')],['socialLinks',t('Sosyal bağlantılar','Social links')],['tags',t('Etiketler','Tags')]] as const
  return <form onSubmit={e=>{e.preventDefault()
    const next={...card,phoneNumbers:card.phoneNumbers.filter(p=>p.number.trim()),addresses:card.addresses.filter(a=>Object.values(a).some(value=>value.trim())),updatedAt:new Date().toISOString()}
    if(!cardSchema.safeParse(next).success){setInvalid(true);return}
    setInvalid(false);review(next)
  }}>
    <h3>{t('Kartviziti kontrol edin','Review the card')}</h3>
    {!!draft.uncertain.length&&<p className="notice">{t('Şüpheli alanlar','Uncertain fields')}: {draft.uncertain.join(', ')}</p>}
    <div className="fields">{fields.map(([key,label])=><label key={key}>{label}<input value={card[key]} maxLength={key==='notes'?30000:1500} onChange={e=>setCard({...card,[key]:e.target.value})}/></label>)}
      {lists.map(([key,label])=><label key={key}>{label}<textarea rows={2} defaultValue={card[key].join('\n')} onChange={e=>setCard({...card,[key]:e.target.value.split('\n').map(x=>x.trim()).filter(Boolean)})}/></label>)}</div>
    <details><summary>{t('Telefonlar ve adresler','Phone numbers and addresses')}</summary>
      {card.phoneNumbers.map((phone,i)=><fieldset key={i}><legend>{t('Telefon','Phone')} {i+1}</legend>
        <label>{t('Numara','Number')}<input type="tel" maxLength={1500} value={phone.number} onChange={e=>setCard({...card,phoneNumbers:card.phoneNumbers.map((p,j)=>i===j?{...p,number:e.target.value}:p)})}/></label>
        <label>{t('Tür','Type')}<select value={phone.kind} onChange={e=>setCard({...card,phoneNumbers:card.phoneNumbers.map((p,j)=>i===j?{...p,kind:e.target.value as typeof p.kind}:p)})}>
          <option value="mobile">{t('Cep','Mobile')}</option><option value="work">{t('İş','Work')}</option><option value="fax">{t('Faks','Fax')}</option><option value="other">{t('Diğer','Other')}</option></select></label>
        <button type="button" onClick={()=>setCard({...card,phoneNumbers:card.phoneNumbers.filter((_,j)=>i!==j)})}>{t('Telefonu kaldır','Remove phone')}</button>
      </fieldset>)}
      <button type="button" disabled={card.phoneNumbers.length>=100} onClick={()=>setCard({...card,phoneNumbers:[...card.phoneNumbers,{number:'',kind:'work'}]})}>{t('Telefon ekle','Add phone')}</button>
      {card.addresses.map((address,i)=><fieldset key={i}><legend>{t('Adres','Address')} {i+1}</legend>
        <div className="fields">{([['street',t('Sokak','Street')],['city',t('Şehir','City')],['country',t('Ülke','Country')],['postalCode',t('Posta kodu','Postal code')]] as const).map(([key,label])=><label key={key}>{label}<input maxLength={1500} value={address[key]} onChange={e=>setCard({...card,addresses:card.addresses.map((a,j)=>i===j?{...a,[key]:e.target.value}:a)})}/></label>)}</div>
        <button type="button" onClick={()=>setCard({...card,addresses:card.addresses.filter((_,j)=>i!==j)})}>{t('Adresi kaldır','Remove address')}</button>
      </fieldset>)}
      <button type="button" disabled={card.addresses.length>=100} onClick={()=>setCard({...card,addresses:[...card.addresses,{street:'',city:'',country:'',postalCode:''}]})}>{t('Adres ekle','Add address')}</button>
    </details>
    {invalid&&<p role="alert">{t('Telefon ve adres biçimini kontrol edin.','Check phone and address format.')}</p>}
    <button type="submit">{t('Kaydı önizle','Preview save')}</button>
  </form>
}

const root=document.getElementById('root')
if(root)createRoot(root).render(<App/>)
