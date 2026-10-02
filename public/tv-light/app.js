/* Classic ES5 entry: keep independent of the Workspace and modern browser APIs. */
(function () {
  'use strict';
  var titles = { 'monthly-goal': 'Meta do mês', pace: 'Ritmo da meta', 'team-goals': 'Metas dos times', 'product-goals': 'Metas dos produtos', sellers: 'Top vendedores', products: 'Top produtos', daily: 'Vendas do dia', 'payment-mix': 'Meios de pagamento' };
  var months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var snapshot = null, panels = [], current = 0, paused = false, stale = false, lastFresh = 0, retryTimer = null, rotationTimer = null, expiryTimer = null, request = null, stopped = false, terminal = false, settingsKey = '';
  var title = document.getElementById('tv-light-title');
  var panel = document.getElementById('tv-light-panel');
  var status = document.getElementById('tv-light-status');
  var notice = document.getElementById('tv-light-error');
  var updated = document.getElementById('tv-light-updated');
  var context = document.getElementById('tv-light-context');
  var eyebrow = document.getElementById('tv-light-eyebrow');
  var previousButton = document.getElementById('tv-light-prev');
  var nextButton = document.getElementById('tv-light-next');
  var pauseButton = document.getElementById('tv-light-pause');
  var retryButton = document.getElementById('tv-light-retry');
  var fullButton = document.getElementById('tv-light-fullscreen');
  var path = /^\/tv-light(?:\/([A-Za-z0-9_-]{16}))?\/?$/.exec(window.location.pathname);
  var api = typeof window.TV_LIGHT_API_URL === 'string' ? window.TV_LIGHT_API_URL.replace(/\/$/, '') : '';

  function esc(value) { return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function finite(value) { return typeof value === 'number' && isFinite(value); }
  function amount(value, unit) {
    if (!finite(value)) return '—';
    var decimals = unit === 'count' ? 0 : 2;
    var parts = Math.abs(value).toFixed(decimals).split('.');
    var text = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (decimals ? ',' + parts[1] : '');
    return (value < 0 ? '−' : '') + (unit === 'currency' ? 'R$ ' : '') + text + (unit === 'percent' ? '%' : '');
  }
  function basis(model) { return model.metric === 'cash' ? 'Cash collected' : model.metric === 'count' ? 'Quantidade de vendas' : 'Valor bruto'; }
  function partial(row, field) { return stale || (row && (typeof row[field + 'Partial'] === 'boolean' ? row[field + 'Partial'] : row.partial)) ? ' · parcial' : ''; }
  function note(text) { return '<p class="tv-light-note">' + esc(text) + '</p>'; }
  function empty(heading, text) { return '<div class="tv-light-empty"><h2>' + esc(heading) + '</h2><p>' + esc(text) + '</p></div>'; }
  function stat(label, value, unit) { return '<div class="tv-light-stat"><span class="tv-light-label">' + esc(label) + '</span><strong>' + amount(value, unit) + '</strong></div>'; }
  function hero(row, label) {
    row = row || {};
    return '<div class="tv-light-hero"><div class="tv-light-hero-cell"><span class="tv-light-label">Valor bruto · ' + esc(label) + partial(row, 'gross') + '</span><strong class="tv-light-gross" data-testid="tv-main-value"><span data-testid="tv-gross-value">' + amount(row.gross, 'currency') + '</span></strong></div><div class="tv-light-hero-cell"><span class="tv-light-label">Cash collected' + partial(row, 'cash') + '</span><strong class="tv-light-cash" data-testid="tv-cash-value">' + amount(row.cash, 'currency') + '</strong><span class="tv-light-label">Novas vendas</span></div></div>';
  }
  function paceStatus(pace, model) {
    if (pace.scopeExcluded) return 'Pessoa fora dos cálculos de desempenho';
    if (pace.membershipUnavailable) return 'Participantes indisponíveis';
    if (model.plansError) return 'Meta não confirmada';
    if (!pace.validTarget) return 'Meta não cadastrada nesta base';
    if (pace.future) return 'Mês ainda não iniciado';
    if (stale || !pace.definitive || model.totals.partial) return 'Leitura parcial · ritmo da meta a confirmar';
    if (pace.ended) return finite(pace.attainment) ? pace.attainment >= 100 ? 'Meta atingida' : 'Mês encerrado abaixo da meta' : 'Resultado a confirmar';
    if (!finite(pace.delta)) return 'Ritmo da meta a confirmar';
    return pace.delta >= 0 ? 'Acima do ritmo esperado' : 'Abaixo do ritmo esperado';
  }
  function goal(model, isPace) {
    var pace = isPace ? model.pace : model.overview;
    var unit = model.unit;
    var html = hero(isPace ? pace : model.totals, isPace ? model.paceName || 'Meta geral' : 'realizado no mês');
    html += '<div class="tv-light-stat-table">';
    html += stat('Realizado · ' + basis(model), pace.actual, unit);
    html += stat('Meta · ' + basis(model), pace.validTarget ? pace.target : null, unit);
    html += stat(isPace ? 'Esperado até hoje' : 'Falta para a meta', isPace ? pace.expected : pace.remaining, unit);
    html += stat(isPace ? 'Projeção estimada' : 'Necessário por dia', isPace ? pace.projection : pace.requiredPerDay, unit) + '</div>';
    html += '<div class="tv-light-pace"><strong>' + esc(paceStatus(pace, model)) + '</strong>';
    if (pace.validTarget && finite(pace.attainment)) html += ' · ' + amount(pace.attainment, 'percent') + ' da meta<div class="tv-light-track" aria-hidden="true"><span style="width:' + Math.max(0, Math.min(100, pace.attainment)) + '%"></span></div>';
    html += '</div>';
    if (isPace) html += note((pace.basis === 'business' ? 'Distribuição em dias úteis, sem calendário de feriados.' : 'Distribuição pelos dias do mês.') + (stale || !pace.definitive ? ' Projeção com dados parciais.' : ' Projeção estimada.'));
    else html += note('Vendas realizadas: ' + amount(model.totals.count, 'count') + '. Base da meta: ' + basis(model) + '.');
    return html;
  }
  function financialCell(row, field) { return '<td class="' + (field === 'cash' ? 'tv-light-table-cash' : '') + '"><strong data-testid="tv-' + field + '-value">' + amount(row[field], 'currency') + '</strong><small>' + (partial(row, field) ? 'Leitura parcial' : '') + '</small></td>'; }
  function table(model, kind) {
    var goals = kind === 'team-goals' || kind === 'product-goals';
    var rows = kind === 'team-goals' ? model.teamGoals : kind === 'product-goals' ? model.productGoals : kind === 'payment-mix' ? model.payments : model[kind];
    var people = kind === 'sellers' || kind === 'team-goals';
    var html, row, pace, i;
    if (people && model.directoryError) return empty('Participantes indisponíveis', 'Não foi possível confirmar os times e vendedores. A TV tentará novamente.');
    if (!rows.length) return empty(goals ? model.plansError ? 'Metas indisponíveis' : 'Sem metas nesta base' : 'Sem resultados neste painel', goals ? 'Confira as metas e a base selecionada na configuração da TV.' : 'Os indicadores aparecerão quando houver novas vendas identificadas.');
    html = '<table class="tv-light-table' + (goals ? ' tv-light-table-goals' : '') + '"><thead><tr><th scope="col">' + (goals ? 'Meta · ' + esc(basis(model)) : 'Ordenação · ' + esc(basis(model))) + '</th><th scope="col">Valor bruto</th><th scope="col">Cash collected</th><th scope="col">' + (goals ? 'Atingimento' : 'Vendas') + '</th></tr></thead><tbody>';
    for (i = 0; i < rows.length && i < 5; i++) {
      row = rows[i];
      html += '<tr><td>' + esc(row.name);
      if (goals) {
        pace = row.pace;
        html += '<small>' + amount(pace.actual, model.unit) + ' / ' + amount(pace.validTarget ? pace.target : null, model.unit) + '</small>';
      }
      html += '</td>' + financialCell(row, 'gross') + financialCell(row, 'cash');
      html += '<td>' + (goals ? pace.validTarget ? amount(pace.attainment, 'percent') : 'Sem meta' : amount(row.count, 'count'));
      if (goals && (stale || !pace.definitive || model.totals.partial)) html += '<small>Parcial · a confirmar</small>';
      html += '</td></tr>';
    }
    html += '</tbody></table>';
    if (rows.length > 5) html += note('Exibindo os 5 primeiros de ' + rows.length + ' resultados recebidos.');
    if (!goals && kind !== 'payment-mix') {
      var unassigned = model.unassigned && model.unassigned[kind === 'sellers' ? 'seller' : 'product'];
      if (unassigned && finite(unassigned.count) && unassigned.count > 0) html += note(amount(unassigned.count, 'count') + ' vendas sem ' + (kind === 'sellers' ? 'vendedor' : 'produto') + ': valor bruto ' + amount(unassigned.gross, 'currency') + ' · cash collected ' + amount(unassigned.cash, 'currency') + '.');
      if (model.attributionAvailable === false) html += note('Atribuições indisponíveis.');
    }
    if (goals) html += note('Cada atingimento usa a própria meta em ' + basis(model) + '.');
    if (kind === 'payment-mix') html += note('Somente novas vendas. Recebimentos de faturas de vendas passadas não entram nesta composição.');
    return html;
  }
  function daily(model) {
    var day = model.daily;
    if (!day.inSelectedMonth) return empty('Hoje está fora do mês selecionado', 'Selecione Mês atual na programação para acompanhar as vendas do dia.');
    var html = hero(day, 'hoje · horário de Brasília');
    html += '<div class="tv-light-stat-table">' + stat('Vendas realizadas hoje', day.count, 'count') + stat('Realizado · ' + basis(model), day.value, model.unit) + '</div>';
    html += note('Dia ' + displayDate(day.date) + ' · horário de Brasília.' + (day.unknownHourCount > 0 ? ' ' + amount(day.unknownHourCount, 'count') + ' vendas com horário não informado.' : ''));
    return html;
  }
  function displayDate(value) { var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || ''); return match ? match[3] + '/' + match[2] + '/' + match[1] : '—'; }
  function readingTime(value) {
    var timestamp = Date.parse(value), pad = function (number) { return number < 10 ? '0' + number : String(number); };
    if (!finite(timestamp)) return 'Horário da leitura não informado';
    var date = new Date(timestamp - 3 * 60 * 60 * 1000);
    return 'Leitura de ' + pad(date.getUTCDate()) + '/' + pad(date.getUTCMonth() + 1) + ' às ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ' · Brasília';
  }
  function monthLabel(value) { var match = /^(\d{4})-(\d{2})$/.exec(value || ''); return match && months[Number(match[2]) - 1] ? months[Number(match[2]) - 1] + ' de ' + match[1] : 'Mês atual'; }
  function noticeText(text) { notice.textContent = text; notice.style.display = text ? 'block' : 'none'; }
  function controls() {
    var enabled = Boolean(snapshot && snapshot.model && panels.length > 1);
    previousButton.disabled = !enabled; nextButton.disabled = !enabled; pauseButton.disabled = !enabled;
    pauseButton.textContent = paused ? 'Retomar' : 'Pausar';
  }
  function state(heading, text, stateName) {
    document.body.setAttribute('data-tv-state', stateName);
    title.textContent = heading; panel.innerHTML = empty(heading, text); panel.removeAttribute('data-panel-id');
    eyebrow.textContent = 'DevClub · TV Light'; status.textContent = terminal ? 'Link indisponível' : 'Nova tentativa automática';
    updated.textContent = 'Atualização automática'; controls();
  }
  function render() {
    if (!snapshot || !snapshot.model || !panels.length) return;
    var model = snapshot.model, id = panels[current].id, theme = snapshot.settings.theme;
    if (theme === 'system') theme = 'dark';
    document.body.setAttribute('data-tv-theme', theme);
    document.body.setAttribute('data-tv-state', stale ? 'stale' : 'ready');
    title.textContent = titles[id]; panel.setAttribute('data-panel-id', id);
    eyebrow.textContent = 'Painel ' + (current + 1) + ' de ' + panels.length + (paused ? ' · pausado' : '');
    context.textContent = monthLabel(model.month || snapshot.settings.month) + ' · ' + basis(model);
    panel.innerHTML = id === 'monthly-goal' || id === 'pace' ? goal(model, id === 'pace') : id === 'daily' ? daily(model) : table(model, id);
    status.textContent = stale ? 'Última leitura · dados parciais' : model.totals.partial || snapshot.error ? 'Dados parciais · atualização automática' : snapshot.refreshing ? 'Atualizando os indicadores…' : 'Atualização automática · 30 segundos';
    updated.textContent = readingTime(snapshot.updatedAt);
    noticeText(stale ? 'Atualização indisponível. Exibindo a última leitura.' : snapshot.error ? 'Alguns indicadores estão indisponíveis. A TV tentará novamente.' : '');
    controls();
  }
  function rotate() {
    clearTimeout(rotationTimer); rotationTimer = null;
    if (stopped || !snapshot || !snapshot.model || paused || panels.length < 2 || snapshot.settings.mode !== 'rotate') return;
    rotationTimer = setTimeout(function () { current = (current + 1) % panels.length; render(); rotate(); }, panels[current].durationSeconds * 1000);
  }
  function move(direction) { if (!snapshot || !snapshot.model || panels.length < 2) return; current = (current + direction + panels.length) % panels.length; render(); rotate(); }
  function valid(value) {
    var settings = value && value.settings, seen = {}, i, item, model = value && value.model;
    if (!settings || settings.version !== 1 || (settings.mode !== 'rotate' && settings.mode !== 'fixed') || !/^(gross|cash|count)$/.test(settings.metric) || !/^(dark|light|system)$/.test(settings.theme) || !Array.isArray(settings.panels) || !settings.panels.length || settings.panels.length > 8 || !finite(value.revision) || value.revision < 0 || Math.floor(value.revision) !== value.revision) return false;
    for (i = 0; i < settings.panels.length; i++) {
      item = settings.panels[i];
      if (!item || !Object.prototype.hasOwnProperty.call(titles, item.id) || seen[item.id] || item.enabled !== true || !finite(item.durationSeconds) || Math.floor(item.durationSeconds) !== item.durationSeconds || item.durationSeconds < 10 || item.durationSeconds > 120) return false;
      seen[item.id] = true;
    }
    if (settings.mode === 'fixed' && (settings.panels.length !== 1 || settings.panels[0].id !== settings.fixedPanel)) return false;
    if (model === null) return value.loading === true || typeof value.error === 'string';
    if (!model || !model.totals || (model.unit !== 'currency' && model.unit !== 'count') || model.metric !== settings.metric) return false;
    for (i = 0; i < settings.panels.length; i++) {
      item = settings.panels[i].id;
      if (item === 'monthly-goal' && (!model.overview || !Array.isArray(model.overview.rows))) return false;
      if (item === 'pace' && (!model.pace || !Array.isArray(model.pace.rows))) return false;
      if (item === 'daily' && (!model.daily || !Array.isArray(model.daily.hours))) return false;
      var rows = item === 'team-goals' ? model.teamGoals : item === 'product-goals' ? model.productGoals : item === 'payment-mix' ? model.payments : item === 'sellers' ? model.sellers : item === 'products' ? model.products : null;
      if (item === 'team-goals' || item === 'product-goals' || item === 'payment-mix' || item === 'sellers' || item === 'products') {
        if (!Array.isArray(rows)) return false;
        for (var j = 0; j < rows.length; j++) if (!rows[j] || typeof rows[j] !== 'object' || ((item === 'team-goals' || item === 'product-goals') && !rows[j].pace)) return false;
      }
    }
    return true;
  }
  function schedule(delay) { clearTimeout(retryTimer); if (!stopped && !terminal) retryTimer = setTimeout(load, delay); }
  function expire() {
    clearTimeout(expiryTimer);
    if (!snapshot || !snapshot.model) return;
    var remaining = 300000 - (Date.now() - lastFresh);
    if (remaining > 0) { expiryTimer = setTimeout(expire, remaining); return; }
    snapshot = null; stale = true; clearTimeout(rotationTimer); rotationTimer = null; noticeText('A última leitura expirou. A TV tentará atualizar novamente.');
    state('Não foi possível atualizar a TV', 'Confira a conexão. Os indicadores serão exibidos assim que a atualização for concluída.', 'unavailable');
  }
  function failed() {
    stale = true;
    if (snapshot && snapshot.model && Date.now() - lastFresh < 300000) { render(); expire(); }
    else { snapshot = null; clearTimeout(rotationTimer); rotationTimer = null; noticeText('A conexão está temporariamente indisponível.'); state('Não foi possível atualizar a TV', 'Confira a conexão e tente novamente. Uma nova tentativa será feita automaticamente.', 'unavailable'); }
    schedule(15000);
  }
  function accepted(value) {
    var key = JSON.stringify(value.settings), changed = key !== settingsKey;
    var freshTimestamp = Date.parse(value.updatedAt), oldId = panels[current] && panels[current].id;
    if (value.model && finite(freshTimestamp) && Date.now() - freshTimestamp >= 300000) { failed(); return; }
    snapshot = value; panels = value.settings.panels; settingsKey = key; terminal = false;
    stale = Boolean(value.error && value.model);
    if (changed) { current = 0; for (var i = 0; i < panels.length; i++) if (panels[i].id === oldId) current = i; }
    if (value.model) {
      lastFresh = finite(freshTimestamp) ? Math.min(Date.now(), freshTimestamp) : Date.now();
      render(); expire(); if (changed || !rotationTimer) rotate();
    } else {
      clearTimeout(rotationTimer); rotationTimer = null; clearTimeout(expiryTimer); noticeText('');
      state(value.loading ? 'Carregando os indicadores' : 'Indicadores indisponíveis', value.loading ? 'Preparando a programação. A TV continuará tentando automaticamente.' : 'A TV tentará carregar os indicadores novamente em instantes.', value.loading ? 'loading' : 'unavailable');
    }
    schedule(value.loading || value.refreshing ? 5000 : value.model ? 30000 : 15000);
  }
  function load() {
    if (stopped || request || !path || !api) return;
    clearTimeout(retryTimer);
    var xhr = new XMLHttpRequest(), finished = false, watchdog;
    request = xhr; retryButton.disabled = true;
    function finish(kind) {
      if (finished) return; finished = true; clearTimeout(watchdog); request = null; retryButton.disabled = false;
      if (stopped) return;
      if (kind === 'response' && (xhr.status === 403 || xhr.status === 404 || xhr.status === 410)) {
        terminal = true; snapshot = null; stale = false; clearTimeout(rotationTimer); rotationTimer = null; clearTimeout(expiryTimer); noticeText('');
        state('Link da TV indisponível', 'O link foi desativado, substituído ou não existe. Solicite ao administrador que confira o acesso público da TV.', 'unavailable');
        return;
      }
      if (kind !== 'response' || xhr.status < 200 || xhr.status >= 300) { failed(); return; }
      try { var value = JSON.parse(xhr.responseText); if (!valid(value)) throw new Error('Invalid presentation'); accepted(value); } catch (error) { void error; /* Invalid responses follow the same retry path as connection failures. */ failed(); }
    }
    try {
      xhr.open('GET', api + '/tv/public' + (path[1] ? '/' + path[1] : ''), true);
      xhr.withCredentials = false;
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.onreadystatechange = function () { if (xhr.readyState === 4) finish('response'); };
      xhr.onerror = function () { finish('error'); };
      xhr.ontimeout = function () { finish('timeout'); };
      xhr.timeout = 20000;
      watchdog = setTimeout(function () { finish('timeout'); try { xhr.abort(); } catch (error) { void error; /* The timeout already cleared the pending request. */ } }, 20000);
      xhr.send(null);
    } catch (error) { void error; /* Older browsers can throw while opening or sending XHR. */ finish('error'); }
  }
  previousButton.onclick = function () { move(-1); };
  nextButton.onclick = function () { move(1); };
  pauseButton.onclick = function () { paused = !paused; render(); rotate(); };
  retryButton.onclick = function () { terminal = false; load(); };
  fullButton.onclick = function () {
    try {
      var root = document.documentElement, action = root.requestFullscreen || root.webkitRequestFullscreen;
      if (document.fullscreenElement || document.webkitFullscreenElement) { action = document.exitFullscreen || document.webkitExitFullscreen; if (action) action.call(document); }
      else if (action) { var result = action.call(root); if (result && typeof result['catch'] === 'function') result['catch'](function () {}); }
    } catch (error) { void error; /* The presentation also works in the browser window. */ }
  };
  document.addEventListener('keydown', function (event) {
    var target = event.target && event.target.tagName;
    if (target === 'INPUT' || target === 'TEXTAREA' || target === 'SELECT') return;
    if (event.keyCode === 37) { event.preventDefault(); move(-1); }
    if (event.keyCode === 39) { event.preventDefault(); move(1); }
    if (event.keyCode === 32 && target !== 'BUTTON' && snapshot && panels.length > 1) { event.preventDefault(); paused = !paused; render(); rotate(); }
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !terminal) { expire(); load(); } });
  window.addEventListener('online', function () { if (!terminal) load(); });
  window.addEventListener('pagehide', function () { stopped = true; clearTimeout(retryTimer); clearTimeout(rotationTimer); clearTimeout(expiryTimer); if (request) { try { request.abort(); } catch (error) { void error; /* Page cleanup must finish even when abort is unavailable. */ } request = null; } });
  window.addEventListener('pageshow', function () { if (stopped) { stopped = false; expire(); if (!terminal) load(); rotate(); } });
  if (!path) { terminal = true; state('Link da TV indisponível', 'Confira o endereço do link público da TV Light.', 'unavailable'); }
  else if (!api) { state('Não foi possível iniciar a TV Light', 'A configuração da conexão não foi carregada. Recarregue esta página.', 'unavailable'); retryButton.onclick = function () { window.location.reload(); }; }
  else load();
}());
