import {readFile,writeFile} from 'node:fs/promises'
const dir=new URL('../work-artifact/',import.meta.url)
let html=await readFile(new URL('index.html',dir),'utf8')
const script=html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/)
if(!script)throw new Error('Artifact bundle missing')
const js=await readFile(new URL(script[1],dir),'utf8')
html=html.replace(script[0],()=>'<script type="module">'+js.replace(/<\/script/gi,'<\\/script')+'</script>')
const style=html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/)
if(style){
  const css=await readFile(new URL(style[1],dir),'utf8')
  html=html.replace(style[0],()=>'<style>'+css+'</style>')
}
await writeFile(new URL('kartvizit-artifact.html',dir),html)
