"""Index observed migration branches against the numbered frozen journeys."""
from collections import defaultdict
from pathlib import Path
import json
import re

ROOT=Path(__file__).resolve().parents[2]
DOCS=ROOT/"docs"
BASE=DOCS/"demo-v2-baseline"
OUT=DOCS/"migration-evidence"
CASES = {
    "D-01":"同一通用应用的两份原生资料，以及同一资料中 A→B→A 换号。",
    "D-02":"使用新建账号、合成成员关系和重新登录重建现场。",
    "D-03":"采用新对象编号，重建任务、讨论、正式计划和私人回答的归属及链接。",
    "D-04":"用新账号写入工作台草稿、结论和蓝图草案后重进。",
    "D-05":"新建同名交付，按任务、来源评论和顺序检查；合成账号生成未读通知。",
    "D-06":"新登记本机端、助手和共享授权。独立受控运行，核对领取、回执和停止。",
    "D-07":"重置后保留任务页；新任务附件失败可重试、移除或取消。",
    "D-08":"真实付费生成、真实供应商凭据、外部 SSH 建连和重连暂缓。",
}
REFS={
    "D-01":"STATE-03 WB-19", "D-02":"AU-05 IN-04", "D-03":"IB-02 TC-09 WB-13",
    "D-04":"STATE-03 STATE-04 BP-15", "D-05":"FL-05 STATE-06", "D-06":"EP-02 RUN-06 RUN-04",
    "D-07":"TL-03 FL-01",
}
DEFERRED = {
    "EP-04":"外部 SSH 密码/密钥连接",
    "EP-05":"远端连接故障与重连",
    "PRB-01":"真实供应商调用",
    "PRB-02":"真实模型完成和远程探测",
    "PRB-03":"使用真实供应商身份进行认证",
    "TK-08":"真实模型草拟质量", "TC-05":"真实生成的结论质量",
    "PL-03":"真实生成规划建议", "PL-04":"真实生成建议质量",
    "WB-05":"真实供应商回答", "WB-06":"真实生成中取消", "WB-07":"真实模型重新生成",
    "RUN-06":"真实 CLI 模型领取、完成与交付", "STATE-07":"真实外部 CLI 在途接续",
}


def safe(value):
    return " ".join(str(value).replace("|","／").split())


def build():
    OUT.mkdir(exist_ok=True, parents=True)
    observed=defaultdict(list)
    for file in sorted(OUT.rglob("*.json")):
        obj=json.loads(file.read_text())
        if not isinstance(obj,dict):
            continue
        for row in obj.get("checks",[]):
            if not isinstance(row,dict) or row.get("status","pass") != "pass":
                continue
            for key in row.get("ids",[]):
                observed[key].append((file,row))
    result=["# 冻结 Demo V2 迁移差异与复验索引","",
        "每个编号链接到冻结原版的条件、操作和判据。右栏只登记实际运行的条件；同一编号下的其他分支仍按原版条目核验。原生、浏览器和后台断言按来源分别保留。角色 A 为合成团队所有者，B 为成员。",
        "", "冻结客户端提交为 `dbf36f4`，Multica 提交为 `a7859a4`。构建和启动环境见[验收入口](README.md)，组件迁移见[控件反查](controls.md)。旧库按 D-02～D-06 选择以新账号重建。", ""]
    stats=defaultdict(int)
    for file in sorted(BASE.glob("[0-9][0-9]-*.md")):
        result += ["## " + file.stem, "", "|编号与条件|实施和证据判定|迁移版实际观察及复验材料|","|---|---|---|"]
        for line in file.read_text().splitlines():
            found=re.match(r'\| <a id="([a-z]+-\d+)"></a>([^|]*)\| ([^|]+)',line)
            if not found: continue
            anchor=found[1]; key=anchor.upper()
            label=f"[{key}](../demo-v2-baseline/{file.name}#{anchor})"
            condition=safe(found[3])
            rows=list(observed.get(key,[]))
            observations=[]
            isdecision=key in CASES
            if isdecision:
                condition=CASES[key]
                for linked in REFS.get(key,"").split():
                    rows+=observed.get(linked,[])
            if key.startswith("X-"):
                status="原版可达性边界"
                observations.append(safe(line.split("|")[3]))
            elif key=="D-08":
                status="外部条件暂缓"
                observations.append("按裁决保留真实外部样本缺口。")
            elif key in {"D-07","TL-03","FL-01"}:
                status="已批准变更" if rows else "变更待补运行记录"
            elif rows:
                status="已记录所列条件" if not isdecision else "按裁决重建"
            elif key in DEFERRED:
                status="本地分支待补证"
            elif isdecision:
                status="按裁决使用合成数据"
            else:
                status="迁移路径已盘点，缺独立运行证据"
            unique=set()
            for evidence,row in rows:
                obs=row.get("observation",row.get("observed",""))
                if isinstance(obs,dict):
                    obs="、".join(f"{k}={v}" for k,v in obs.items() if k not in {"sha256","pid"})
                desc=safe(obs)
                marker=(desc, str(evidence.parent.relative_to(OUT)))
                if not desc or marker in unique: continue
                unique.add(marker)
                path=evidence.relative_to(OUT)
                scope=safe(row.get("condition",""))
                img=row.get("image")
                ref=f"[{path.parent}]({path})"
                if img and (evidence.parent/img).exists():
                    ref+=f" [图]({path.parent/img})"
                observations.append((scope+"。" if scope else "")+desc+" "+ref)
            if key in DEFERRED:
                observations.append("D-08 暂缓 "+DEFERRED[key]+"。")
            if not observations:
                observations.append("按相邻旅程及[控件反查](controls.md)定位，当前证据不足以确认这一条件。")
            result.append("|"+label+" "+condition+"|"+status+"|"+"<br>".join(observations)+"|")
            stats[status]+=1
        result.append("")
    (OUT/"matrix.md").write_text("\n".join(result).rstrip()+"\n")
    print(json.dumps(stats,ensure_ascii=False),sum(stats.values()))


if __name__=="__main__":
    build()
