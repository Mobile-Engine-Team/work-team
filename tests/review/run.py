"""Replay the project, revision conflict and private workbench journeys."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

from common import ROOT, RUNTIME, Review, open_page, seed, signin
import projects
import workbench
import surfaces


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ports", nargs=2, type=int, metavar=("CDP_A", "CDP_B"))
    parser.add_argument("--only", choices=("projects", "workbench", "surfaces"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    surface = "native" if args.ports else "browser"
    review = Review(args.output or ROOT / ".local/review" / surface)
    accounts, password, ws, issue = seed()
    import plistlib
    info = plistlib.loads((RUNTIME / "desktop/Team Workbench.app/Contents/Info.plist").read_bytes())
    review.report.update(build=info["WorkbenchBuild"],surface=surface, accounts={key: obj["user"]["name"] for key, obj in zip(("A","B"), accounts)}, workspace=ws["slug"])
    with sync_playwright() as pw:
        a,b = [open_page(pw, label, port) for label,port in zip(("a","b"),args.ports or (None,None))]
        for p,account in zip((a,b), accounts):
            p.set_default_timeout(9000)
            signin(p, account, password, ws["slug"])
        review.report["viewport"] = a.evaluate("({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,language:navigator.language})")
        review.save()
        try:
            if args.only in (None,"projects"):
                projects.run(review,a,b,accounts,ws)
            if args.only in (None,"workbench"):
                workbench.run(review,a,b,accounts,ws,issue)
            if args.only in (None,"surfaces"):
                surfaces.run(review,a,ws,accounts[0]["user"]["id"],issue["id"])
        except Exception:
            for label,page in zip(("a","b"), (a,b)):
                # UI snapshots from this synthetic run only. Strip private entry URLs.
                (review.out / ("failure-" + label + ".txt")).write_text(page.locator("body").aria_snapshot())
            raise
    review.report["status"] = "pass"
    review.save()
    print("Evidence", review.out)


if __name__ == "__main__":
    main()
