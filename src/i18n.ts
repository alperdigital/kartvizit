export type Translate = (tr:string,en:string)=>string
export type Settings = {language:'tr'|'en';theme:'system'|'light'|'dark';ocr:'tur+eng'|'tur'|'eng';photos:boolean}
export const defaults:Settings={language:'tr',theme:'system',ocr:'tur+eng',photos:false}
export function loadSettings():Settings {
  try {
    const input=JSON.parse(localStorage.getItem('kartvizit-settings')??'null')
    if(!input) return defaults
    return {
      language:input.language==='en'?'en':'tr',
      theme:input.theme==='light'||input.theme==='dark'?input.theme:'system',
      ocr:input.ocr==='tur'||input.ocr==='eng'?input.ocr:'tur+eng',
      photos:input.photos===true,
    }
  } catch {return defaults}
}
