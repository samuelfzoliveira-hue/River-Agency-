(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ---- Menu mobile
  var burger = $('#burger'), nav = $('#nav');
  function closeNav() { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menu'); }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });

  // ---- Entrada suave
  var items = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else { items.forEach(function (el) { el.classList.add('in'); }); }

  // ---- Barra de progresso + seção ativa
  var bar = $('#progress');
  function onScroll() {
    var h = root.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var links = $$('.nav a');
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) so.observe(s); });
  }

  // ---- Aviso
  var toast = $('#toast'), tt;
  function say(msg) { toast.textContent = msg; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('show'); }, 1800); }

  // ---- Copiar cor
  $$('.dot[data-hex]').forEach(function (b) {
    b.addEventListener('click', function () {
      var hex = b.dataset.hex;
      function ok() { b.classList.add('copied'); say('Copiado ' + hex); setTimeout(function () { b.classList.remove('copied'); }, 1500); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(hex).then(ok, function () { say(hex); });
      else say(hex);
    });
  });

  // ---- Teste de fundo
  var stage = $('#testStage'), timg = $('#testImg'), tname = $('#testName');
  var names = { '#fef8eb': 'Off white · versão colorida', '#e8600a': 'Laranja · versão azul escuro', '#792608': 'Marrom escuro · versão off white', '#061c2c': 'Azul escuro · versão off white' };
  $$('.sw').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.sw').forEach(function (o) { o.classList.remove('is-on'); o.setAttribute('aria-pressed', 'false'); });
      b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true');
      stage.style.background = b.dataset.bg; stage.dataset.bg = b.dataset.bg;
      timg.classList.add('swap');
      setTimeout(function () { timg.src = b.dataset.logo; timg.classList.remove('swap'); }, 220);
      tname.textContent = names[b.dataset.bg];
    });
  });

  // ---- Monograma: pontos
  $$('.hot').forEach(function (h) {
    var note = document.getElementById(h.dataset.note);
    function on() { note.classList.add('on'); } function off() { note.classList.remove('on'); }
    h.addEventListener('mouseenter', on); h.addEventListener('mouseleave', off);
    h.addEventListener('focus', on); h.addEventListener('blur', off);
    h.addEventListener('click', function () { note.classList.add('on'); setTimeout(function () { note.classList.remove('on'); }, 2200); });
  });

  // ---- Tipografia: estilos
  var sample = $('#typeSample');
  $$('.roles button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.roles button').forEach(function (o) { o.setAttribute('aria-selected', 'false'); });
      b.setAttribute('aria-selected', 'true'); sample.dataset.role = b.dataset.role;
    });
  });
  sample.addEventListener('paste', function (e) {
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, t);
  });

  // ---- Lightbox
  var zoomables = [];
  $$('.stage, .apps figure, .icons li').forEach(function (el) {
    var img = $('img', el); if (!img) return;
    el.setAttribute('data-zoom', ''); el.tabIndex = 0; el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Ampliar: ' + img.alt);
    zoomables.push(el);
  });
  var lb = document.createElement('div');
  lb.className = 'lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Imagem ampliada');
  lb.innerHTML = '<button class="lb__btn lb__close" type="button" aria-label="Fechar">×</button><button class="lb__btn lb__prev" type="button" aria-label="Anterior">‹</button><button class="lb__btn lb__next" type="button" aria-label="Próxima">›</button><figure class="lb__fig"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>';
  document.body.appendChild(lb);
  var limg = $('.lb__img', lb), lcap = $('.lb__cap', lb), cur = -1, lastFocus = null;
  function show(i) {
    cur = (i + zoomables.length) % zoomables.length;
    var el = zoomables[cur], img = $('img', el);
    limg.src = img.currentSrc || img.src; limg.alt = img.alt; lcap.textContent = img.alt;
    var png = /\.png/.test(img.src);
    limg.classList.toggle('lb__img--panel', png);
    if (png) {
      var bg = getComputedStyle(el).backgroundColor;
      limg.style.background = (bg && bg !== 'rgba(0, 0, 0, 0)') ? bg : '#fef8eb';
    } else limg.style.background = '';
  }
  function open(i) { lastFocus = document.activeElement; show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; $('.lb__close', lb).focus(); }
  function close() { lb.classList.remove('open'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  zoomables.forEach(function (el, i) {
    el.addEventListener('click', function () { open(i); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
  });
  $('.lb__close', lb).addEventListener('click', close);
  $('.lb__prev', lb).addEventListener('click', function () { show(cur - 1); });
  $('.lb__next', lb).addEventListener('click', function () { show(cur + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (lb.classList.contains('open')) close(); else closeNav(); }
    if (!lb.classList.contains('open')) return;
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  var tx = 0;
  lb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1)); });
})();
