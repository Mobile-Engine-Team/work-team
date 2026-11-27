"""Build the side-by-side screenshot index from actual replay output."""
import argparse
import io
from html import escape
import os
from pathlib import Path
from PIL import Image, ImageChops, ImageCms, ImageStat

ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'docs/demo-v2-baseline/evidence'

def srgb(image):
    profile = image.info.get('icc_profile')
    source = ImageCms.ImageCmsProfile(io.BytesIO(profile)) if profile else None
    image = image.convert('RGB')
    if not source:
        return image, '未嵌入（按 sRGB）'
    return (ImageCms.profileToProfile(image, source, ImageCms.createProfile('sRGB')),
            ImageCms.getProfileDescription(source).strip())

def relative(path, base):
    return escape(os.path.relpath(path,base))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('evidence',type=Path,nargs='+')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    entries=[]
    for directory in args.evidence:
        for path in sorted(directory.glob('[0-9][0-9]-*.png')):
            original=BASE/path.name
            if not original.exists():
                continue
            with Image.open(original) as base, Image.open(path) as current:
                if current.size!=base.size:
                    raise ValueError(f'{path.name}: {current.size} ≠ {base.size}')
                basergb, base_icc = srgb(base)
                newrgb, new_icc = srgb(current)
                diff=ImageChops.difference(basergb,newrgb)
                mae=sum(ImageStat.Stat(diff).mean)/3
                pixels=base.width*base.height
                maxima=diff.convert('L')
                above=sum(maxima.histogram()[21:])/pixels
            entries.append((path.name,path,mae,above,base_icc,new_icc))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    body=[]
    for name,path,mae,above,base_icc,new_icc in sorted(entries,key=lambda row:row[0]):
        original=relative(BASE/name,args.output.parent)
        new=relative(path,args.output.parent)
        body.append(f'<section><h2>{escape(name)}</h2><p>sRGB 平均绝对差 {mae:.2f} / 255 · 亮度差大于 20 的像素 {above:.1%} · 原版 ICC {escape(base_icc)} / 迁移版 ICC {escape(new_icc)}</p>'
                    f'<div><figure><a href="{original}"><img loading="lazy" src="{original}" alt="冻结原版"></a><figcaption>冻结原版</figcaption></figure>'
                    f'<figure><a href="{new}"><img loading="lazy" src="{new}" alt="迁移版"></a><figcaption>迁移版</figcaption></figure></div></section>')
    if not body:
        raise ValueError('No comparable screenshots')
    args.output.write_text('''<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><title>冻结 V2 与迁移版画面对照</title>
<style>body{max-width:1550px;margin:2rem auto;padding:0 1.25rem;color:#242b33;font:16px/1.6 -apple-system,sans-serif}h1{font-size:1.7rem}h2{font-size:1.05rem;margin-bottom:0}section{border-top:1px solid #bbb;padding-bottom:1rem}section p{margin:.3rem 0;color:#454f5a}section div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;height:auto;border:1px solid #ddd}figcaption{text-align:center}a:focus-visible{outline:3px solid #285aad}</style>
<h1>冻结 V2 与迁移版画面对照</h1><p>按原版图号排列。点击图像打开原始分辨率。时间、合成账号和业务数据会产生像素差异。焦点、权限及写入结果见对应旅程的验收记录。</p>'''+''.join(body)+'</html>')

if __name__=='__main__':
    main()
