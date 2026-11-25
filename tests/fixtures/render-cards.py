from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

out = Path(sys.argv[1])
out.mkdir(exist_ok=True, parents=True)
fonts = Path("C:/Windows/Fonts")
title = ImageFont.truetype(str(fonts/"arialbd.ttf"), 70)
body = ImageFont.truetype(str(fonts/"arial.ttf"), 41)
tag = ImageFont.truetype(str(fonts/"arialbd.ttf"), 24)

def card(filename, background, text, accent, name, lines, rotate=False):
    im=Image.new("RGB",(1200,650),background)
    draw=ImageDraw.Draw(im)
    draw.polygon([(1040,0),(1200,0),(1200,650),(878,650)],fill=accent)
    draw.rectangle((75,82,148,90),fill=text)
    draw.text((77,119),name,font=title,fill=text)
    for index,line in enumerate(lines):
        draw.text((80,241+index*56),line,font=body,fill=text)
    draw.text((80,570),"SENTETİK TEST VERİSİ / SYNTHETIC FIXTURE",font=tag,fill=text)
    if rotate:
        im=im.transpose(Image.Transpose.ROTATE_90)
    im.save(out/filename,optimize=True)

card("sentetik-deniz-on.png","#f5f8ff","#15284c","#dae6ff","Deniz Örnek",[
    "Uluslararası Ürün ve Tasarım Direktörü","Örnek Teknoloji A.Ş. · Tasarım","deniz@example.test · studio@example.test",
    "+90 212 555 01 42 · +1 202 555 0142"])
card("sentetik-deniz-arka.png","#15284c","#f5f8ff","#243f72","Örnek Teknoloji A.Ş.",[
    "Örnek Sokak 12, Kat 3","Kadıköy, İstanbul 34710","Türkiye","https://example.test"])
card("sentetik-english-rotated.png","#eceef2","#737b8a","#e0e4eb","Example Studio",[
    "Research & Product Operations","team@example.test","+44 20 7946 0958","London, United Kingdom"], True)
