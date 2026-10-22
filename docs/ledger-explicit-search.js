/* Ledger explicit-search mode: defer expensive shard downloads and filtering until Apply. */
(() => {
  const filterIds = ["ledgerYear","ledgerSeason","ledgerScope","ledgerRegion","ledgerPref","ledgerSubArea","ledgerSchool","ledgerUnion","ledgerSource","ledgerSort"];
  const get = id => document.getElementById(id);
  let dirty = false, busy = false;
  function markPending() {
    dirty = true;
    const status = get("ledgerSearchStatus");
    if (status) status.textContent = "条件を変更しました。「この条件で表示」を押すと検索します。";
    const btn = get("ledgerApplyFilters");
    if (btn) btn.classList.add("pending");
  }
  // Capture before existing bubble handlers, which otherwise download a year immediately.
  document.addEventListener("change", event => {
    if (!filterIds.includes(event.target?.id)) return;
    event.stopImmediatePropagation();
    markPending();
  }, true);
  document.addEventListener("input", event => {
    if (event.target?.id !== "ledgerSchool") return;
    event.stopImmediatePropagation();
    markPending();
  }, true);
  document.addEventListener("click", async event => {
    if (event.target?.id !== "ledgerApplyFilters") return;
    event.preventDefault();
    if (busy) return;
    busy = true;
    const btn = get("ledgerApplyFilters");
    const status = get("ledgerSearchStatus");
    btn.disabled = true;
    status.textContent = "必要なデータを読み込み、検索しています…";
    try {
      // A selected year loads only that year's shard (or the selected regional shard).
      await ensureLedgerSelectionData();
      setupLedgerUi();
      ledgerPage = 1;
      renderLedger();
      dirty = false;
      btn.classList.remove("pending");
      status.textContent = "表示しました。条件を変更しても、次にボタンを押すまで再検索しません。";
    } catch (err) {
      console.error("Explicit ledger search failed",err);
      status.textContent = "検索に失敗しました。条件を確認して再度お試しください。";
    } finally {
      busy = false;
      btn.disabled = false;
    }
  }, true);
  // Search field legacy debounce is also silenced by the capturing input listener.
  // Clear/reset actions keep their current behavior; this modification affects filter entry only.
})();
