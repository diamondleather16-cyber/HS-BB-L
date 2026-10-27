/* Conservative batch school-ID linker v1: explicit links untouched, exact name+pref only. */
(function(){
"use strict";
const normal=s=>String(s||"").normalize("NFKC").replace(/[\s　・･]/g,"").replace(/[ヶケ]/g,"ケ").trim();
const plain=s=>String(s||"").normalize("NFKC").replace(/\s*[（(](?:[^()（）]*?(?:[1-9１-９]位?|代表|補欠))[)）]\s*$/u,"").trim();
function candidates(raw,pref){
  const p=typeof normalizePrefectureName==="function"?normalizePrefectureName(pref):pref;
  if(!p)return [];
  const key=normal(plain(raw));
  if(!key)return [];
  return [...schoolMaster.values()].filter(rec=>{
    if(!rec.school_id||rec.status==="merged"||rec.kind==="union")return false;
    if(normalizePrefectureName(rec.prefecture)!==p)return false;
    return [rec.canonical_name,...(rec.aliases||[])].some(v=>normal(v)===key);
  });
}
function prepare(){
  const seen=new Set(), todo=[], unknown=[], ambiguous=[], existing=[];
  const rows=typeof filteredLedgerMatches==="function"?filteredLedgerMatches():ledgerMatches;
  for(const r of rows){
    const editKey=matchEditKey(r);
    for(const side of ["team1","team2"]){
      const k=editKey+"|"+side;
      if(seen.has(k))continue;seen.add(k);
      if(specificLinkForRow(r,side)||r[side+"_school_id"]){existing.push(k);continue;}
      const pref=sidePrefHint(r,side);
      const found=candidates(r[side],pref);
      if(found.length===1)todo.push({editKey,side,row:r,rec:found[0]});
      else if(found.length>1)ambiguous.push({raw:r[side],pref});
      else unknown.push({raw:r[side],pref});
    }
  }
  return {todo,unknown,ambiguous,existing};
}
let busy=false;
async function run(){
  if(busy)return;
  const result=prepare(), {todo,unknown,ambiguous,existing}=result;
  const message="対象（現在の台帳検索条件内）\n自動確定候補: "+todo.length+"件\n既存の紐づけ: "+existing.length+"件\n要確認: "+ambiguous.length+"件\n未解決: "+unknown.length+"件\n\n同一県の学校マスターと名称が完全一致するものだけをGitHubへ保存します。既存の紐づけは変更しません。";
  if(!todo.length){alert(message);return;}
  if(!confirm(message+"\n\n"+todo.length+"件を自動紐づけしますか？"))return;
  busy=true;
  const b=document.getElementById("safeAutoLinkBtn");
  if(b){b.disabled=true;b.textContent="GitHubへ保存中…";}
  try{
    const checks=[];
    for(const x of todo){
      // Revalidate immediately before writing (manual link may have been applied meanwhile).
      if(specificLinkForRow(x.row,x.side)||x.row[x.side+"_school_id"])continue;
      upsertMatchTeamLink(x.editKey,x.side,x.rec);
      x.row[x.side+"_school_id"]=x.rec.school_id;
      x.row[x.side+"_canonical"]=x.rec.canonical_name;
      checks.push(teamLinkVerification(x.editKey,x.side,x.rec));
    }
    persistPendingMatchEdits();
    await saveMatchEditsImmediately("Auto link unambiguous school names ("+checks.length+")",[],[],checks);
    markIdentityIndexesDirty();buildFastIndexes();renderLedger();
    alert("自動紐づけ保存完了: "+checks.length+"件。曖昧 "+ambiguous.length+"件・未解決 "+unknown.length+"件は変更していません。");
  }catch(e){
    console.error(e);
    alert("保存が完了していません。保留中の変更を残しました。\n"+(e?.message||e));
  }finally{
    busy=false;if(b){b.disabled=false;b.textContent="学校名を自動紐づけ";}
  }
}
function install(){
  if(document.getElementById("safeAutoLinkBtn"))return;
  const anchor=document.getElementById("ledgerPageSize")||document.getElementById("ledgerCount");
  if(!anchor)return;
  const btn=document.createElement("button");
  btn.id="safeAutoLinkBtn";btn.type="button";btn.className="ghost";
  btn.textContent="学校名を自動紐づけ";btn.style.cssText="margin:8px;padding:10px 12px;white-space:normal;";
  btn.title="現在の台帳検索条件内で、県と校名の一意一致のみGitHub保存";
  btn.addEventListener("click",run);
  anchor.parentElement?.appendChild(btn);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);
else install();
})();
