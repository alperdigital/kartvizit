import { useState } from 'react'
import { Database, Download, ShieldCheck, Smartphone, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import type { Settings as SettingsData,Translate } from '../i18n'
import { restore } from '../services/export'
import { ClaudeTransfer } from './ClaudeTransfer'

export function Settings({t,value,change,prepare,ocrStatus,onExport,onDelete,notify}:{t:Translate;value:SettingsData;change:(value:SettingsData)=>void;prepare:()=>void;ocrStatus:string;onExport:()=>void;onDelete:()=>void;notify:(message:string)=>void}) {
  const [importing,setImporting]=useState(false)
  async function read(file?:File){
    if(!file)return
    setImporting(true)
    try{const result=await restore(file);notify(t(`${result.added} kayıt eklendi, ${result.skipped} mevcut kayıt korundu.`,`${result.added} records added, ${result.skipped} existing records preserved.`))}
    catch{notify(t('Yedek açılamadı. Geçerli bir Kartvizit JSON dosyası seçin (en fazla 50 MB).','Could not restore. Select a valid Kartvizit JSON backup (up to 50 MB).'))}
    finally{setImporting(false)}
  }
  return <section className="screen-flow">
    <div className="page-heading"><div><h1>{t('Ayarlar','Settings')}</h1><p>{t('Görünümü, çevrimdışı taramayı ve yerel verilerinizi yönetin.','Manage appearance, offline scanning and local data.')}</p></div></div>
    <div className="panel screen-flow">
      <h2><SlidersHorizontal/>{t('Uygulama tercihleri','Preferences')}</h2>
      <div className="form-grid">
        <label>{t('Tema','Theme')}<select aria-label={t('Tema','Theme')} value={value.theme} onChange={e=>change({...value,theme:e.target.value as SettingsData['theme']})}><option value="system">{t('Sistem','System')}</option><option value="light">{t('Açık','Light')}</option><option value="dark">{t('Koyu','Dark')}</option></select></label>
        <label>{t('Arayüz dili','Interface language')}<select aria-label={t('Arayüz dili','Interface language')} value={value.language} onChange={e=>change({...value,language:e.target.value as SettingsData['language']})}><option value="tr">Türkçe</option><option value="en">English</option></select></label>
        <label>{t('Varsayılan OCR dili','Default OCR language')}<select aria-label={t('Varsayılan OCR dili','Default OCR language')} value={value.ocr} onChange={e=>change({...value,ocr:e.target.value as SettingsData['ocr']})}><option value="tur+eng">Türkçe + English</option><option value="tur">Türkçe</option><option value="eng">English</option></select></label>
        <label className="check"><input type="checkbox" checked={value.photos} onChange={e=>change({...value,photos:e.target.checked})}/>{t('Yeni taramaların fotoğrafını sakla','Keep photos of new scans')}</label>
      </div>
      <div className="section-heading"><div><h3>{t('Çevrimdışı tarama','Offline scanning')}</h3><p role="status">{ocrStatus}</p></div><button onClick={prepare}><Download/>{t('OCR kaynaklarını indir','Download OCR resources')}</button></div>
    </div>
    <ClaudeTransfer t={t} notify={notify} setup/>
    <div className="panel screen-flow">
      <h2><Database/>{t('Veri ve yedekleme','Data and backup')}</h2>
      <p>{t('JSON yedeğini cihaz dışında saklayarak arşivinizi koruyabilirsiniz. İçe aktarma mevcut kayıtları korur.','Keep a JSON backup outside this device to protect your archive. Importing preserves existing records.')}</p>
      <div className="actions"><button onClick={onExport}><Download/>{t('Dışa aktar ve yedekle','Export and back up')}</button><label className="button file-button"><Upload/>{t('Yedeği geri yükle','Restore backup')}<input disabled={importing} type="file" accept=".json,application/json" aria-label={t('Yedek dosyası','Backup file')} onChange={e=>{void read(e.target.files?.[0]);e.target.value=''}}/></label><button className="danger" onClick={onDelete}><Trash2/>{t('Tüm kayıtları sil','Delete all cards')}</button></div>
    </div>
    <div className="panel screen-flow">
      <h2><Smartphone/>{t('Ana ekrana ekle','Add to Home Screen')}</h2>
      <p><strong>iPhone Safari</strong> · {t('Paylaş menüsünü açın, Ana Ekrana Ekle seçeneğine ve Ekle’ye dokunun.','Open Share, choose Add to Home Screen, then tap Add.')}</p>
      <p><strong>Android Chrome</strong> · {t('Üç nokta menüsünden Uygulamayı yükle veya Ana ekrana ekle seçeneğini kullanın.','In the three-dot menu, choose Install app or Add to Home screen.')}</p>
    </div>
    <div className="panel screen-flow">
      <h2><ShieldCheck/>{t('Gizlilik ve lisanslar','Privacy and licenses')}</h2>
      <p>{t('Kartvizitler, OCR metinleri ve isteğe bağlı fotoğraflar bu tarayıcının IndexedDB alanında saklanır. OCR cihazda çalışır. Takip ve reklam yoktur. Cihazlar arası senkronizasyon yapılmaz. Tarayıcı verileri temizlendiğinde veya işletim sistemi yer açtığında arşiv silinebilir.','Cards, OCR text and optional photos are stored in this browser’s IndexedDB. OCR runs on your device. There is no tracking or advertising. Data does not sync across devices. Clearing browsing data or storage eviction may erase the archive.')}</p>
      <div className="actions"><a className="button" href={import.meta.env.BASE_URL+'privacy.html'}>{t('Gizlilik politikası','Privacy policy')}</a><a className="button" href={import.meta.env.BASE_URL+'licenses.txt'}>{t('Açık kaynak lisansları','Open-source licenses')}</a></div>
      <p>Kartvizit · v1.0.0</p>
    </div>
  </section>
}

