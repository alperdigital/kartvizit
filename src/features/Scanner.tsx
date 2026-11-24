import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, ScanLine, RotateCw, Trash2, X } from 'lucide-react'
import { type Translate, type Settings } from '../i18n'
import { checkImage,noCrop,png,processImage,type Crop } from '../services/images'
import { ocr } from '../services/ocr'
import { BusinessCardParser,type OcrResult } from '../services/parser'
import type { Card } from '../services/cards'

interface Side {file:File; rotation:number;crop:Crop;threshold:boolean;url:string}
interface Item {id:string;sides:Side[];result?:Card;error?:boolean}
const newSide=(file:File):Side=>({file,rotation:0,crop:{...noCrop},threshold:false,url:URL.createObjectURL(file)})
export function Scanner({t,settings,onReview,manual,saved}:{t:Translate;settings:Settings;onReview:(card:Card,id:string)=>void;manual:()=>void;saved:string[]}) {
  const [items,setItems]=useState<Item[]>([])
  const [error,setError]=useState('')
  const [active,setActive]=useState<number|null>(null)
  const [drag,setDrag]=useState(false)
  const [percent,setPercent]=useState(0)
  const cancel=useRef<AbortController|null>(null)
  const urls=useRef(new Set<string>())
  const gallery=useRef<HTMLInputElement>(null)
  const camera=useRef<HTMLInputElement>(null)
  useEffect(()=>{const allocated=urls.current;return()=>{cancel.current?.abort();allocated.forEach(URL.revokeObjectURL)}},[])
  function add(files:FileList|null,back?:string) {
    if(!files?.length || cancel.current)return
    setError('')
    const sides:Side[]=[]
    for(const file of Array.from(files).slice(0,back?1:30)){
      try{checkImage(file);const side=newSide(file);urls.current.add(side.url);sides.push(side)}
      catch{setError(t('JPEG, PNG, WebP veya cihazın okuyabildiği HEIC seçin. Dosya en fazla 25 MB olabilir.','Choose JPEG, PNG, WebP or a HEIC your device can read. The limit is 25 MB per file.'))}
    }
    if(!sides.length)return
    setItems(old=>back?old.map(item=>item.id===back?{...item,sides:[item.sides[0],sides[0]],result:undefined}:item):[...old,...sides.map(side=>({id:crypto.randomUUID(),sides:[side]}))])
  }
  function edit(id:string,index:number,patch:Partial<Side>) {
    setItems(old=>old.map(item=>item.id===id?{...item,result:undefined,sides:item.sides.map((side,i)=>i===index?{...side,...patch}:side)}:item))
  }
  function remove(item:Item,index?:number) {
    const removed=index===undefined?item.sides:[item.sides[index]]
    removed.forEach(side=>{URL.revokeObjectURL(side.url);urls.current.delete(side.url)})
    setItems(old=>index===undefined?old.filter(x=>x.id!==item.id):old.map(x=>x.id===item.id?{...x,sides:x.sides.filter((_,i)=>i!==index),result:undefined}:x))
  }
  async function run(only?:string) {
    if(cancel.current)return
    setError('')
    const controller=new AbortController()
    cancel.current=controller
    const pending=items.filter(item=>only?item.id===only:!item.result&&!saved.includes(item.id))
    for(const [index,item] of pending.entries()){
      if(controller.signal.aborted)break
      setActive(index+1)
      setPercent(0)
      try{
        const results:OcrResult[]=[]
        const photos:string[]=[]
        for(const [sideIndex,side] of item.sides.entries()){
          const image=await processImage(side.file,side.rotation,side.crop,side.threshold,true)
          const blob=await png(image)
          image.width=0
          results.push(await ocr.recognize(blob,settings.ocr,p=>setPercent(Math.round((sideIndex+p)*100/item.sides.length)),controller.signal))
          if(settings.photos){
            const photo=await processImage(side.file,side.rotation,side.crop,false,false)
            photos.push(photo.toDataURL('image/jpeg',.76))
            photo.width=0
          }
        }
        const result=new BusinessCardParser().parse({text:results.map(r=>r.text).join('\n\n'),confidence:Math.min(...results.map(r=>r.confidence)),lines:results.flatMap(r=>r.lines)})
        if(photos.length)result.photos=photos
        setItems(old=>old.map(value=>value.id===item.id?{...value,result,error:false}:value))
        if(pending.length===1 && !controller.signal.aborted)onReview(result,item.id)
      }catch{
        if(!controller.signal.aborted) setItems(old=>old.map(value=>value.id===item.id?{...value,error:true}:value))
      }
    }
    if(controller.signal.aborted)setError(t('Tarama iptal edildi.','Scan canceled.'))
    cancel.current=null
    setActive(null)
  }
  return <section className="screen-flow">
    <div className="page-heading"><div><h1>{t('Kartvizit tara','Scan a card')}</h1><p>{t('Ön ve arka yüzü ekleyin, ardından okunan bilgileri kontrol edin.','Add the front and back, then review the extracted details.')}</p></div></div>
    <input ref={gallery} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" aria-label={t('Kartvizit görselleri','Card images')} hidden onChange={e=>{add(e.target.files);e.target.value=''}}/>
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>{add(e.target.files);e.target.value=''}}/>
    <div className={'dropzone '+(drag?'drag':'')} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);add(e.dataTransfer.files)}}>
      <div className="icon-tile"><ScanLine/></div>
      <h2>{t('Kartvizit fotoğrafı ekleyin','Add a business card photo')}</h2>
      <p>{t('Dosyalarınızı buraya bırakın veya aşağıdan bir kaynak seçin.','Drop files here or choose a source below.')}</p>
      <div className="actions"><button className="primary" disabled={active!==null} onClick={()=>camera.current?.click()}><Camera/>{t('Kamera','Camera')}</button><button disabled={active!==null} onClick={()=>gallery.current?.click()}><ImagePlus/>{t('Galeriden seç','Choose photos')}</button><button className="plain" onClick={manual}>{t('Manuel ekle','Add manually')}</button></div>
    </div>
    {error&&<p role="alert" className="notice">{error}</p>}
    {active!==null&&<div className="panel scan-progress"><div role="status">{t('Kartvizit işleniyor','Processing card')} {active} · %{percent}</div><progress max="100" value={percent}/><button onClick={()=>cancel.current?.abort()}><X/>{t('İptal','Cancel')}</button></div>}
    {active===null&&items.some(item=>!item.result&&!saved.includes(item.id))&&<div className="actions"><button className="primary" onClick={()=>void run()}><ScanLine/>{t('Taramayı başlat','Start scan')}</button></div>}
    {items.map((item,index)=><article className="panel scanner-item" key={item.id}>
      <div className="section-heading"><h2>{t('Kartvizit','Card')} {index+1}{saved.includes(item.id)?' · '+t('Kaydedildi','Saved'):''}</h2><button className="icon-button" aria-label={t('Görseli kaldır','Remove image')} disabled={active!==null} onClick={()=>remove(item)}><Trash2/></button></div>
      {item.error&&<p className="notice" role="alert">{t('Görsel okunamadı. Biçimi ve OCR kaynaklarının erişilebilirliğini kontrol edin.','The image could not be read. Check the format and OCR resource availability.')}</p>}
      <div className="side-grid">{item.sides.map((side,i)=><div key={side.url}>
        <div className="preview-image"><img src={side.url} alt={i?t('Arka yüz','Back side'):t('Ön yüz','Front side')} style={{transform:'rotate('+side.rotation+'deg)',clipPath:`inset(${side.crop.top}% ${side.crop.right}% ${side.crop.bottom}% ${side.crop.left}%)`}}/></div>
        <div className="actions"><button disabled={active!==null} onClick={()=>edit(item.id,i,{rotation:(side.rotation+90)%360})}><RotateCw/>{t('Döndür','Rotate')}</button>{i>0&&<button disabled={active!==null} onClick={()=>remove(item,i)}>{t('Arka yüzü kaldır','Remove back')}</button>}</div>
        <details><summary>{t('Kırpma ve kontrast','Crop and contrast')}</summary>
          <div className="form-grid">{(['left','top','right','bottom'] as const).map((edge,k)=><label key={edge}>{[t('Sol','Left'),t('Üst','Top'),t('Sağ','Right'),t('Alt','Bottom')][k]} · {side.crop[edge]}%<input type="range" min="0" max="40" value={side.crop[edge]} disabled={active!==null} onChange={e=>edit(item.id,i,{crop:{...side.crop,[edge]:+e.target.value}})}/></label>)}</div>
          <label className="check"><input type="checkbox" checked={side.threshold} disabled={active!==null} onChange={e=>edit(item.id,i,{threshold:e.target.checked})}/>{t('Siyah beyaz eşikleme','Black and white threshold')}</label>
        </details>
      </div>)}</div>
      <div className="actions">
        {item.sides.length===1&&<label className="button file-button">{t('Arka yüz ekle','Add back side')}<input disabled={active!==null} type="file" accept="image/*,.heic,.heif" onChange={e=>{add(e.target.files,item.id);e.target.value=''}}/></label>}
        {item.result&&!saved.includes(item.id)&&<button disabled={active!==null} className="primary" onClick={()=>onReview(item.result!,item.id)}>{t('Sonucu incele','Review result')}</button>}
        {!saved.includes(item.id)&&(item.error||item.result)&&<button disabled={active!==null} onClick={()=>void run(item.id)}>{t('Yeniden tara','Scan again')}</button>}
      </div>
    </article>)}
  </section>
}
