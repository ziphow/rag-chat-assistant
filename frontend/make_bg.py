# -*- coding: utf-8 -*-
from PIL import Image
import os

src = r"D:\Desktop\杂项\TraeWork\页面\HTML1\assets\material"
dst = os.path.join(src, "web")
os.makedirs(dst, exist_ok=True)

jobs = [
    ("【哲风壁纸】云-图片-夜空.jpg", "bg-cloud-night.jpg"),
    ("【哲风壁纸】后印象派-夜空.jpg", "bg-impression-night.jpg"),
    ("【哲风壁纸】人工智能艺术-地平线.png", "bg-horizon.jpg"),
    ("【哲风壁纸】倒影-天空-山脉.jpg", "bg-reflection.jpg"),
    ("【哲风壁纸】交通锥-城市街道.jpg", "bg-city.jpg"),
    ("【哲风壁纸】中式-剑-卷轴.jpg", "bg-sword.jpg"),
]

MAXW = 1920
QUALITY = 82

for name, out in jobs:
    p = os.path.join(src, name)
    im = Image.open(p).convert("RGB")
    w, h = im.size
    if w > MAXW:
        nh = round(h * MAXW / w)
        im = im.resize((MAXW, nh), Image.LANCZOS)
    op = os.path.join(dst, out)
    im.save(op, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    print(out, im.size, os.path.getsize(op))

print("DONE")