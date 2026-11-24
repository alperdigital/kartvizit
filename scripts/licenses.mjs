import { readdir, readFile, writeFile } from 'node:fs/promises'
const lock=JSON.parse(await readFile('package-lock.json','utf8'))
const parts=['Kartvizit · Third-party licenses','OCR trained data: Tesseract OCR project, Apache-2.0 (see Tesseract.js Core below).']
for (const [path,info] of Object.entries(lock.packages)) {
  if(!path || info.dev && !path.startsWith('node_modules/workbox-')) continue
  let entries
  try {entries=await readdir(path)} catch {continue}
  const notices=await Promise.all(entries.filter(name=>/^(licen[sc]e|copying|notice)(\.\w+)?$/i.test(name)).map(name=>readFile(path+'/'+name,'utf8').catch(()=>'')))
  parts.push(path.replace(/^node_modules\//,'')+' '+info.version+' · '+(info.license??''),...notices)
}
await writeFile('public/licenses.txt',parts.join('\n\n')+'\n')
