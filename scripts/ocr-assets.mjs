import { mkdir, copyFile } from 'node:fs/promises'
await mkdir('public/ocr', {recursive:true})
const files={
  'worker.min.js':'tesseract.js/dist/worker.min.js',
}
for (const suffix of ['lstm','simd-lstm','relaxedsimd-lstm']) {
  const name='tesseract-core-'+suffix+'.wasm.js'
  files[name]='tesseract.js-core/'+name
}
for (const lang of ['tur','eng']) files[lang+'.traineddata.gz']='@tesseract.js-data/'+lang+'/4.0.0_best_int/'+lang+'.traineddata.gz'
for (const [target,source] of Object.entries(files)) await copyFile('node_modules/'+source,'public/ocr/'+target)
for (const [target,source] of Object.entries({'LICENSE-tesseract':'tesseract.js/LICENSE.md','LICENSE-core':'tesseract.js-core/LICENSE'})) {
  await copyFile('node_modules/'+source,'public/ocr/'+target)
}
