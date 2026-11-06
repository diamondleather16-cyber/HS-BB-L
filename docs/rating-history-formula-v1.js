/* Authoritative rating formula disclosure. No client-side recalculation. */
(()=>{
"use strict";
const LEVEL={branch:"支部",district_qualifier:"地区予選",first_qualifier:"一次予選",preliminary:"予選",qualifier_league:"予選リーグ",repechage:"敗者復活",prefecture:"県階層",regional:"地区大会",national:"全国大会"};
const num=(x,d=4)=>Number.isFinite(Number(x))?Number(x).toFixed(d):"—";
const text=(x)=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function detail(event){
 const e=event||{},isReset=e.event_type==="generation_reset";
 const before=Number(e.rating_before),after=Number(e.rating_after),delta=Number(e.rating_delta);
 if(isReset){
  return `<strong>世代交代補正</strong><p>1000 + (試合前Rating − 1000) × 0.65</p>
  <p>1000 + (${num(before,4)} − 1000) × 0.65 = ${num(after,4)} / 変動 ${num(delta,4)}</p>
  <small>${text(e.event_note||"")}</small>`;
 }
 let f={};
 try{f=JSON.parse(e.calculation_detail||"{}")||{}}catch(_){}
 const label=LEVEL[e.level]||e.level||"不明";
 const lvl=Number(f.level_weight),k=Number(f.k),expected=Number(f.expected),score=Number(f.result),share=Number(f.share);
 const ready=!!e.calculation_detail&&Number.isFinite(k)&&Number.isFinite(expected);
 const base=`<strong>大会階層：${text(label)}</strong>（${text(e.level||"不明")}）<br>
 階層係数：${Number.isFinite(lvl)?num(lvl,4):"旧データのため詳細待ち"}<br>
 大会規模係数：${text(e.tournament_size_weight||"—")} ／ ラウンド係数：${text(e.round_weight||"—")}<br>
 ラウンド規則：${text(e.round_rule||"—")} ／ 連勝係数：${text(e.win_count_weight||"—")}<br>
 分配率：${num(Number(e.share||1)*100,2)}%`;
 if(!ready)return base+`<p>現在公開されている履歴には計算に必要な係数が不足しています。新形式の再計算・公開後、以下の計算式と全係数を表示します。</p><p>記録済み変動：${num(delta,4)}</p>`;
 const factors=[
  ["基礎K",f.base_k],
  ["大会規模",f.tournament_size_weight],
  ["階層",f.level_weight],
  ["季節",f.season_weight],
  ["ラウンド",f.round_weight],
  ["連勝",f.win_count_weight],
  ["点差",f.mov_multiplier],
  ["イニング",f.inning_multiplier]
 ];
 const product=factors.map(x=>Number(x[1]));
 const calcK=product.reduce((a,b)=>a*b,1);
 const actualDelta=k*(score-expected)*share;
 const residual=delta-actualDelta;
 const factorsHtml=factors.map(([label,value])=>`<tr><td>${text(label)}</td><td>${num(value,6)}</td></tr>`).join("");
 return base+`
 <div style="margin-top:10px"><strong>実計算式（この学校側）</strong></div>
 <p>K = ${factors.map(x=>num(x[1],4)).join(" × ")} = ${num(calcK,6)}</p>
 <p>期待勝率 = ${num(expected,6)} ／ 実結果 = ${num(score,2)}（勝1、敗0、引分0.5）</p>
 <p>Δ = K × (結果 − 期待勝率) × 分配率</p>
 <p>Δ = ${num(k,6)} × (${num(score,2)} − ${num(expected,6)}) × ${num(share,6)}
 = <strong>${num(actualDelta,4)}</strong></p>
 <p>記録済み変動：<strong>${num(delta,4)}</strong>（丸め誤差 ${num(residual,6)}）</p>
 <table style="font-size:.85em"><tbody>${factorsHtml}</tbody></table>
 <p>期待勝率の補正：県勢力 ${num(f.pref_strength,4)} Rating点、県相性 ${num(f.pref_matchup,4)} Rating点、学校間相性による勝率補正 ${num(f.school_matchup_bias,6)}。<br>
 県勢力・県相性を反映した基礎期待勝率 ${num(f.expected_base,6)} → 最終 ${num(expected,6)}。</p>`;
}
let serial=0;
async function decorate(){
 const body=document.getElementById("ratingHistoryBody"),modal=document.getElementById("ratingHistoryModal");
 if(!body||!modal||modal.classList.contains("hidden"))return;
 const table=body.querySelector(".rating-history-table");
 if(!table||table.dataset.formulaV1==="ready")return;
 const token=++serial;
 const name=String(document.getElementById("ratingHistoryTitle")?.textContent||"").split(" / Rating")[0].trim();
 if(typeof loadSchoolHistoryBundle!=="function"||!name)return;
 try{
  const bundle=await loadSchoolHistoryBundle(name);
  if(token!==serial||!table.isConnected)return;
  const cutoff=typeof rankingSnapshotDateValue==="function"?rankingSnapshotDateValue():"";
  const events=[...(bundle.events||[])].filter(e=>!cutoff||eventBeforeOrOn(e,cutoff)).sort(eventChronoCompare).reverse();
  const rows=[...table.querySelectorAll("tbody tr")];
  if(rows.length!==events.length)return;
  rows.forEach((tr,i)=>{
   const td=tr.children[5],e=events[i];
   if(!td||!e)return;
   const button=document.createElement("button");button.type="button";button.className="ghost";button.style.cssText="display:block;margin:3px auto;font-size:12px;padding:2px 5px";
   button.textContent="計算根拠";
   const panel=document.createElement("div");
   panel.style.cssText="display:none;min-width:260px;max-width:420px;text-align:left;padding:10px;background:var(--surface,#f5f7fa);color:var(--text,#222);border:1px solid #aaa;border-radius:7px;font-size:12px;line-height:1.6;white-space:normal;overflow-wrap:anywhere";
   panel.innerHTML=detail(e);
   button.addEventListener("click",()=>{const opened=panel.style.display!=="none";panel.style.display=opened?"none":"block";button.textContent=opened?"計算根拠":"閉じる"});
   td.append(button,panel);
  });
  table.dataset.formulaV1="ready";
 }catch(err){console.warn("Rating formula details unavailable",err)}
}
let queued=false;
function schedule(){if(queued)return;queued=true;setTimeout(()=>{queued=false;decorate()},100)}
function start(){new MutationObserver(schedule).observe(document.getElementById("ratingHistoryBody")||document.body,{childList:true,subtree:true});document.getElementById("ratingHistoryModal")?.addEventListener("click",schedule);schedule();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
