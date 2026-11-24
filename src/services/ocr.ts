import type { Worker } from 'tesseract.js'
import type { OcrResult } from './parser'
export type OcrLanguage = 'tur+eng'|'tur'|'eng'
export interface OcrProvider {
  recognize(image:Blob, language:OcrLanguage, progress:(value:number)=>void, signal:AbortSignal):Promise<OcrResult>
}
const root=() => new URL(import.meta.env.BASE_URL+'ocr/',location.origin).href
const names=['worker.min.js','tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js','tur.traineddata.gz','eng.traineddata.gz']
const cacheName='kartvizit-ocr-v1'
export async function ocrReady() {
  if (!('caches' in globalThis) || !navigator.serviceWorker?.controller) return false
  const cache=await caches.open(cacheName)
  return (await Promise.all(names.map(name=>cache.match(root()+name)))).every(Boolean)
}
export async function prepareOcr(progress:(done:number,total:number)=>void) {
  if (!('caches' in globalThis)) throw new Error('Cache Storage unavailable')
  const cache=await caches.open(cacheName)
  for (const [index,name] of names.entries()) {
    if (!await cache.match(root()+name)) await cache.add(root()+name)
    progress(index+1,names.length)
  }
}
let worker:Worker|undefined
let currentLanguage:OcrLanguage|undefined
let onProgress:(value:number)=>void=()=>{}
export const ocr:OcrProvider={
  async recognize(image,language,progress,signal) {
    signal.throwIfAborted()
    const {createWorker}=await import('tesseract.js')
    signal.throwIfAborted()
    onProgress=progress
    if (worker && language!==currentLanguage) {
      await worker.terminate()
      worker=undefined
    }
    let pending:Promise<Worker>|undefined
    let initializationError:(reason:unknown)=>void=()=>{}
    if (!worker) {
      currentLanguage=language
      const failure=new Promise<never>((_,reject)=>{initializationError=reject})
      const start=createWorker(language.split('+'),1,{
        workerPath:root()+'worker.min.js',corePath:root().replace(/\/$/,''),langPath:root().replace(/\/$/,''),
        workerBlobURL:false,
        logger:m=>onProgress(m.status==='recognizing text'?.55+m.progress*.45:.05+m.progress*.15),
        errorHandler:reason=>initializationError(reason),
      })
      pending=Promise.race([start,failure])
      void pending.catch(()=>{void start.then(w=>w.terminate(),()=>{})})
    }
    let rejectAbort:(reason:unknown)=>void=()=>{}
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject})
    const stop=(reason:unknown)=>{
      rejectAbort(reason)
      const stopped=worker
      worker=undefined
      if (stopped) void stopped.terminate()
      else void pending?.then(w=>w.terminate(),()=>{})
    }
    const cancel=()=>stop(signal.reason)
    const timeout=setTimeout(()=>stop(new Error('OCR timed out')),90_000)
    signal.addEventListener('abort',cancel,{once:true})
    if(signal.aborted) cancel()
    try {
      if(pending) worker=await Promise.race([pending,aborted])
      if(!worker)throw new Error('Worker not running')
      const {data}=await Promise.race([worker.recognize(image,undefined,{text:true,blocks:true}),aborted])
      return {text:data.text,confidence:data.confidence,lines:(data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.map(l=>({
        text:l.text, confidence:l.confidence, height:l.bbox.y1-l.bbox.y0,
      }))))}
    } catch (error) {
      if (!signal.aborted) {
        await worker?.terminate()
        worker=undefined
      }
      throw error
    } finally {
      clearTimeout(timeout)
      signal.removeEventListener('abort',cancel)
      onProgress=()=>{}
    }
  },
}
