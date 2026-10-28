#!/usr/bin/env python3
"""Exit 0 if rating inputs are semantically unchanged between two revisions."""
import json,subprocess,sys
old,new=sys.argv[1:3]
paths=subprocess.check_output(["git","diff","--name-only",old,new,"--","master","data","history","scripts"],text=True).splitlines()
def blob(rev,path):
    try:return subprocess.check_output(["git","show",f"{rev}:{path}"])
    except subprocess.CalledProcessError:return None
real=[]
for p in paths:
    if p=="master/rating_rebuild_request.json":continue
    if p=="master/match_edits_shared.json":
        try:
            a=json.loads(blob(old,p));b=json.loads(blob(new,p))
            if isinstance(a,dict) and isinstance(b,dict):
                a.pop("updated_at",None);b.pop("updated_at",None)
                if a==b:
                    print("Ignoring metadata-only edit journal timestamp change")
                    continue
        except (ValueError,TypeError):pass
    real.append(p)
if real:
    print("Rating-affecting changes:",*real,sep="\n  ")
    sys.exit(1)
print("Rating inputs unchanged; safe to publish calculated snapshot")
