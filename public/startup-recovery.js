/* Runs before application modules; deliberately has no imports or storage writes. */
(function () {
  'use strict';
  var script = document.currentScript;
  var standalone = script && script.getAttribute('data-mode') === 'recovery';
  var base = new URL((script && script.getAttribute('data-base')) || './', document.baseURI);
  var build = (script && script.getAttribute('data-build')) || 'recovery';
  var panel, status, detail, updateButton, observer, lastError = '', busy = false;
  var timer = 0, poll = 0, stopUpdate = null;
  function blank() {
    var root = document.getElementById('root');
    return standalone || !root || root.childElementCount === 0;
  }
  function hideIfReady() {
    if (blank()) return false;
    if (panel) { panel.remove(); panel = null; }
    clearTimeout(timer);
    if (observer) observer.disconnect();
    if (stopUpdate) stopUpdate();
    return true;
  }
  function message(text) { if (status) status.textContent = text; }
  function diagnostics() {
    return 'SullyOS 启动诊断\n构建：' + build + '\n页面：' + location.origin + location.pathname +
      '\n浏览器：' + navigator.userAgent + '\n网络：' + (navigator.onLine === false ? '离线' : '在线') +
      '\n报错：' + (lastError || '主程序尚未启动，暂未捕获到错误');
  }
  function refreshDetail() { if (detail) detail.value = diagnostics(); }
  function navigate() {
    if (hideIfReady()) return;
    if (stopUpdate) stopUpdate();
    if (standalone) location.replace(base.href);
    else location.reload();
  }
  function update() {
    if (busy) return;
    if (!navigator.serviceWorker) { message('当前浏览器无法使用网页更新服务，请先尝试重新打开；仍失败时复制诊断反馈。'); return; }
    clearTimeout(timer);
    busy = true; updateButton.disabled = true; message('正在检查网页更新，聊天与存档不会被删除…');
    var active = true, registration, approved;
    function stopped() {
      active = false; busy = false; clearTimeout(timer); clearInterval(poll);
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
      if (updateButton) updateButton.disabled = false;
      stopUpdate = null;
    }
    function fail() {
      if (!active) return;
      stopped(); message('更新尚未完成。请检查网络后重试；也可以关闭这个站点的其他标签页和桌面入口，再重新打开。');
    }
    function changed() {
      if (active && approved && navigator.serviceWorker.controller === approved) navigate();
    }
    function inspect() {
      if (!active || hideIfReady()) return;
      if (registration.waiting) {
        if (approved === registration.waiting) return;
        approved = registration.waiting; message('新版已准备好，正在重新打开…');
        try { approved.postMessage({type:'SULLY_ACTIVATE_UPDATE'}); } catch (_) { fail(); }
      } else if (registration.installing) message('正在下载新版启动资源，请保持页面打开…');
      else if (!approved || approved.state === 'activated') navigate();
    }
    stopUpdate = stopped;
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    timer = setTimeout(fail, 120000);
    navigator.serviceWorker.getRegistration(base.href).then(function (existing) {
      if (!active) return null;
      // Preserve this registration and its push subscription. Never unregister it.
      return existing || navigator.serviceWorker.register(new URL('sw-keep-alive.js', base).href, {scope:base.href, updateViaCache:'none'});
    }).then(function (value) {
      if (!active || !value) return;
      if (new URL(value.scope).href !== base.href) throw new Error('Unexpected service worker scope');
      registration = value;
      return registration.update().then(function () {
        if (!active) return;
        poll = setInterval(inspect, 500); inspect();
      });
    }).catch(fail);
  }
  function show() {
    if (hideIfReady()) return;
    if (panel) { refreshDetail(); return; }
    panel = document.createElement('section'); panel.id = 'sully-startup-recovery';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#f8f3ec;color:#473b34;padding:calc(32px + env(safe-area-inset-top,0px)) 24px 32px;box-sizing:border-box;font:15px/1.7 system-ui,sans-serif;text-align:left';
    var card = document.createElement('div'); card.style.cssText = 'max-width:480px;margin:8vh auto'; panel.appendChild(card);
    var title = document.createElement('h1'); title.textContent = standalone ? '网页启动修复' : lastError ? '启动遇到问题' : '启动尚未完成';
    title.style.cssText = 'font-size:24px;font-weight:600;margin:0 0 16px'; card.appendChild(title);
    status = document.createElement('p'); status.textContent = '可以检查网页更新后重试。这里不会清除聊天、角色、图片或推送订阅。'; card.appendChild(status);
    function button(label, action) {
      var el = document.createElement('button'); el.type = 'button'; el.textContent = label;
      el.style.cssText = 'font:inherit;border:1px solid #bca895;border-radius:12px;padding:10px 16px;background:#fffaf4;color:#473b34;margin:8px 8px 8px 0;cursor:pointer';
      el.onclick = action; card.appendChild(el); return el;
    }
    updateButton = button('检查更新并重试', update);
    button('重新打开', navigate);
    var details = document.createElement('details'), summary = document.createElement('summary');
    summary.textContent = '启动诊断（可复制给开发者）'; details.appendChild(summary);
    detail = document.createElement('textarea'); detail.readOnly = true; detail.setAttribute('aria-label','启动诊断');
    detail.style.cssText = 'box-sizing:border-box;width:100%;height:180px;margin:12px 0;padding:12px;font:12px/1.6 monospace;color:#473b34;background:white;border:1px solid #d8cbbd;border-radius:8px;user-select:text';
    details.appendChild(detail); card.appendChild(details); refreshDetail();
    button('复制启动诊断', function () {
      details.open = true; refreshDetail(); detail.focus(); detail.select();
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(detail.value).then(function () { message('启动诊断已复制，可粘贴给开发者。'); }, function () { message('请长按诊断文字复制。'); });
      else message('请长按诊断文字复制。');
    });
    (document.body || document.documentElement).appendChild(panel);
  }
  function capture(text) {
    if (!blank()) return;
    lastError = String(text || '启动资源加载失败').slice(0, 3000);
    setTimeout(show, 0);
  }
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (event.message) capture(event.message + (event.filename ? '\n' + event.filename.split('?')[0] + ':' + event.lineno : ''));
    else if (target && target.tagName === 'SCRIPT') capture('启动脚本加载失败：' + (target.src || '').split('?')[0]);
  }, true);
  window.addEventListener('unhandledrejection', function (event) { capture(event.reason && event.reason.message || event.reason); });
  function watchRoot() {
    if (hideIfReady()) return;
    var root = document.getElementById('root');
    if (root && window.MutationObserver) { observer = new MutationObserver(hideIfReady); observer.observe(root, {childList:true}); }
    if (standalone) show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRoot, {once:true});
  else watchRoot();
  timer = setTimeout(show, standalone ? 0 : 12000);
}());
