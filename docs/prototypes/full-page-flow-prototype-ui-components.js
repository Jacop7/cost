(function(){
  const roleSelectors={
    card:'.card,.expo-list-card,.business-card,.change-overview,.stock-check-card,.profit-detail-card,.channel-profit-card,.revenue-card,.sales-menu-card,.tax-choice-block',
    row:'.row,.setting-row,.stock-option-choice,.expo-row,.expo-manage-row,.option-row,.fixed-item-row,.revenue-row,.sales-live-row,.sales-menu-row,.channel-profit-row,.tax-select-row,.choice-card,.detail-list-row,.stock-add-summary-row,.category-row,.sheet-choice-row,.sales-breakdown-row,.revenue-summary-row,.tax-summary-row,.fixed-summary-row,.fixed-edit-row,.analysis-summary-row',
    'row-group':'.expo-rows,.detail-list,.category-list,.sales-live-list,.past-list,.sales-breakdown,.revenue-summary,.option-link-list,.expo-manage-list,.expo-pick-list,.settings-list,.change-list,.prototype-sheet-group',
    'choice-row':'.expo-pick-card,.prototype-sheet-row,.past-row,.option-link-item,.tax-choice,.sheet-choice',
    'section-header':'.expo-section-head,.card-head,.summary-head,.inbound-head,.price-card-head,.channel-profit-head,.profit-detail-head,.menu-summary-title,.detail-head',
    'metric-grid':'.summary-grid',
    'metric-cell':'.metric',
    field:'.edit-form-box,.stock-add-box,.stock-add-select,.prototype-input-shell,.date-field input,.expense-form input,.avg-input,.sheet-input-preview,.tax-rate-box,.order-empty-select,.recipe-sim-price-input',
    'field-multiline':'.expense-form textarea,.memo-preview textarea,.recipe-memo-edit textarea',
    'field-label':'.edit-form-label,.stock-add-label,.prototype-field-label,.date-field,.avg-field-label,.sheet-field-label,.tax-field-label',
    result:'.stock-result-value-card,.stock-total-card,.prototype-result-card,.sheet-result,.avg-convert,.form-result,.price-preview,.tax-basis-preview,.stock-add-preview',
    badge:'.badge,.expo-status,.expo-category,.expo-target,.profit-badge,.hub-status,.inbound-count,.tax-market-badge,.business-state',
    filter:'.expo-sort,.condition-filter,.recipe-filter,.chip,.filter-option',
    'scroll-tabs':'.tabs',
    segmented:'.segmented,.recipe-cost-tabs,.sheet-preview-tabs',
    tab:'.tab,.segmented button,.recipe-cost-tabs button,.sheet-preview-tab',
    button:'.primary,.expo-fab,.sales-add,.order-button,.filter-apply,.empty-action,.edit-menu-close,.option-card-action,.confirm-cancel,.confirm-delete',
    primary:'.primary,.expo-fab,.sales-add,.order-button,.filter-apply',
    'icon-button':'.header-icon,.expo-icon-button,.prototype-sheet-close,.back,.row-more,.stock-check-more,.channel-more',
    meta:'.row-top,.row-sub,.sheet-meta,.history-date-time,.expo-card-foot,.expo-pick-meta,.hub-eyebrow,.stock-option-copy small',
    'date-time':'.history-date-time,.change-list-copy time',
    'section-title':'.section-label,.detail-section-title,.revenue-section-title,.tax-section-label,.sheet-section,.change-month-label,.month',
    notice:'.callout,.ingredient-option-note,.flow-note,.sales-note,.sheet-note,.category-note,.avg-intro,.setting-intro',
    empty:'.empty-inline,.stock-option-empty,.order-empty-message,.avg-empty,.tax-empty',
    layer:'.sheet,.delete-preview,.option-popover',
    'layer-title':'#sheet-body>h2,.prototype-sheet-title h2,.option-more-title',
    'layer-footer':'.prototype-actions,.sheet-actions,.option-card-actions,.stock-option-actions,.confirm-actions',
    'detail-block':'.stock-event-summary,.stock-confirm-summary,.delete-target,.confirm-target',
    'sticky-action':'.bottom-action',
    'row-title':'.row-title,.setting-copy strong,.stock-option-copy strong,.expo-row-copy strong,.expo-manage-copy strong,.change-list-copy strong,.expo-pick-title,.sales-menu-name,.option-link-name,.category-copy strong,.detail-list-copy strong,.choice-card-copy strong',
    'row-sub':'.row-sub,.setting-copy small,.stock-option-copy small,.expo-row-copy small,.expo-manage-copy small,.change-list-copy small,.sales-menu-sub,.detail-list-copy small,.choice-card-copy small,.fixed-ledger-sub,.past-day',
    value:'.values b,.metric b,.summary-head strong,.expo-stock b,.expo-row-value,.stock-total-result strong,.after,.before,.sales-amount,.sales-percent,.channel-profit-value,.fixed-item-values,.fixed-edit-amount,.analysis-summary-value,.sales-menu-values',
    'value-label':'.sales-label,.fixed-item-label,.stock-result-label,.menu-summary-copy small,.fixed-summary-copy small',
    summary:'.revenue-summary,.analysis-summary,.tax-summary,.fixed-ledger-card',
    'summary-row':'.revenue-summary-row,.analysis-summary-row,.tax-summary-row,.fixed-summary-row,.menu-summary-row'
  };

  function addRole(element,role){
    const roles=new Set((element.getAttribute('data-ui')||'').split(/\s+/).filter(Boolean));
    roles.add(role);
    element.setAttribute('data-ui',[...roles].join(' '));
  }

  function removeRole(element,role){
    const roles=(element.getAttribute('data-ui')||'').split(/\s+/).filter(item=>item&&item!==role);
    if(roles.length)element.setAttribute('data-ui',roles.join(' '));
    else element.removeAttribute('data-ui');
  }

  function roleElements(root,selector){
    const elements=[];
    if(root.nodeType===1&&root.matches?.(selector))elements.push(root);
    root.querySelectorAll?.(selector).forEach(element=>elements.push(element));
    return elements;
  }

  function normalizeRoles(root){
    roleElements(root,'[data-ui~="field-multiline"]').forEach(element=>removeRole(element,'field'));
    roleElements(root,'[data-ui~="field"][data-ui~="choice-row"]').forEach(element=>removeRole(element,'choice-row'));
    roleElements(root,'[data-ui~="summary-row"]').forEach(element=>removeRole(element,'row'));
    roleElements(root,'[data-ui~="row-group"]').forEach(element=>{
      const parentSurface=element.parentElement?.closest('[data-ui~="card"],[data-ui~="summary"]');
      if(parentSurface){removeRole(element,'card');addRole(element,'nested')}
      else{removeRole(element,'nested');addRole(element,'card')}
    });
    roleElements(root,'[data-ui~="summary"]').forEach(element=>{
      removeRole(element,'card');
      const parentSurface=element.parentElement?.closest('[data-ui~="card"],[data-ui~="summary"]');
      if(parentSurface)addRole(element,'nested');else removeRole(element,'nested');
    });
    roleElements(root,'[data-ui~="layer"]').forEach(element=>{
      ['sheet','dialog','popover'].forEach(role=>removeRole(element,role));
      const type=element.closest('.overlay')?.dataset.layerType||'';
      const variant=element.matches('.delete-preview')||['ConfirmDialog','SuccessDialog','ErrorDialog'].includes(type)?'dialog':element.matches('.option-popover')||type==='PopoverMenu'?'popover':'sheet';
      addRole(element,variant);
    });
    roleElements(root,'[data-ui~="scroll-tabs"],[data-ui~="segmented"]').forEach(element=>{
      if(!element.hasAttribute('role'))element.setAttribute('role','tablist');
    });
    roleElements(root,'[data-ui~="tab"]').forEach(element=>{
      if(!element.hasAttribute('role'))element.setAttribute('role','tab');
      if(!element.hasAttribute('aria-selected'))element.setAttribute('aria-selected',String(element.classList.contains('active')));
    });
    roleElements(root,'[data-ui~="icon-button"]').forEach(element=>{
      const label=element.getAttribute('aria-label')||element.getAttribute('title')||'';
      const visible=(element.textContent||'').trim();
      if(!label&&(!visible||/^[‹›×＋+⋮.·•]+$/.test(visible)))console.warn('[prototype-ui] 아이콘 버튼 이름 누락',element.className);
    });
  }

  function applyPrototypeUiRoles(root=document){
    if(!root)return;
    for(const [role,selector] of Object.entries(roleSelectors)){
      if(root.nodeType===1&&root.matches?.(selector))addRole(root,role);
      root.querySelectorAll?.(selector).forEach(element=>addRole(element,role));
    }
    normalizeRoles(root);
  }

  let queued=false;
  const observer=new MutationObserver(records=>{
    if(queued||!records.some(record=>record.addedNodes.length))return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;applyPrototypeUiRoles(document)});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.applyPrototypeUiRoles=applyPrototypeUiRoles;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>applyPrototypeUiRoles(document));
  else applyPrototypeUiRoles(document);
})();
