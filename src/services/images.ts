export interface Crop {left:number;top:number;right:number;bottom:number}
export const noCrop:Crop={left:0,top:0,right:0,bottom:0}
export function checkImage(file:File) {
  if (!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('format')
  if (!file.size || file.size>25*1024*1024) throw new Error('size')
}
export async function processImage(file:File, rotation:number, crop:Crop, threshold:boolean, enhance:boolean) {
  checkImage(file)
  const bytes=new Uint8Array(await file.slice(0,24).arrayBuffer())
  const ascii=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end))
  const supported=bytes[0]===255&&bytes[1]===216&&bytes[2]===255 || ascii(1,4)==='PNG'&&bytes[0]===137 ||
    ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP' || ascii(4,8)==='ftyp'&&/heic|heif|heix|hevc|hevx|mif1|msf1/.test(ascii(8,24))
  if(!supported)throw new Error('format')
  const image=await decodeImage(file)
  try {
    const sw=image.width*(1-(crop.left+crop.right)/100)
    const sh=image.height*(1-(crop.top+crop.bottom)/100)
    const scale=Math.min(1,(enhance?1900:1350)/Math.max(sw,sh))
    const sideways=rotation%180!==0
    const canvas=document.createElement('canvas')
    canvas.width=Math.max(1,Math.round((sideways?sh:sw)*scale))
    canvas.height=Math.max(1,Math.round((sideways?sw:sh)*scale))
    const ctx=canvas.getContext('2d',{willReadFrequently:enhance})!
    ctx.fillStyle='white'
    ctx.fillRect(0,0,canvas.width,canvas.height)
    ctx.translate(canvas.width/2,canvas.height/2)
    ctx.rotate(rotation*Math.PI/180)
    ctx.drawImage(image,image.width*crop.left/100,image.height*crop.top/100,sw,sh,-sw*scale/2,-sh*scale/2,sw*scale,sh*scale)
    if (enhance) {
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height)
      const {data}=pixels
      const gray=new Uint8ClampedArray(data.length/4)
      for(let i=0;i<gray.length;i++) gray[i]=data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114
      for(let i=0;i<gray.length;i++){
        const y=Math.floor(i/canvas.width)
        const cleaned=y>0&&y<canvas.height-1?(gray[i]*6+gray[i-canvas.width]+gray[i+canvas.width])/8:gray[i]
        const value=threshold?(cleaned>155?255:0):128+(cleaned-128)*1.1
        data[i*4]=value
        data[i*4+1]=value
        data[i*4+2]=value
      }
      ctx.putImageData(pixels,0,0)
    }
    return canvas
  } finally {if('close' in image)image.close()}
}
export const png=(canvas:HTMLCanvasElement)=>new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Canvas encoding failed')),'image/png'))

async function decodeImage(file:File):Promise<ImageBitmap|HTMLImageElement> {
  try{return await createImageBitmap(file,{imageOrientation:'from-image'})}
  catch {
    const url=URL.createObjectURL(file)
    try {
      const image=new Image()
      await new Promise<void>((resolve,reject)=>{
        image.onload=()=>resolve()
        image.onerror=()=>reject(new Error('Image decoding failed'))
        image.src=url
      })
      return image
    }finally{URL.revokeObjectURL(url)}
  }
}
