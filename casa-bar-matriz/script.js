/* ============================================================
   CONFIGURAÇÃO — preencha com os dados reais da Casa Bar Matriz
   ============================================================ */
const CONFIG = {
  whatsapp: '',   // somente dígitos com DDI+DDD, ex.: '5571999999999'
  telefone: '',   // texto exibido, ex.: '(71) 99999-9999'
  endereco: '',   // ex.: 'Rua Exemplo, 123 — Bairro, Cidade/UF'
  horario: '',    // ex.: 'Ter a dom, das 11h às 23h'
};

(function () {
  document.documentElement.classList.add('js');

  // Dados de contato
  document.querySelectorAll('[data-cfg]').forEach(function (el) {
    var v = CONFIG[el.dataset.cfg];
    if (v) el.textContent = v;
  });
  var waBase = CONFIG.whatsapp ? 'https://wa.me/' + CONFIG.whatsapp : '';
  function waLink(text) {
    return waBase ? waBase + (text ? '?text=' + encodeURIComponent(text) : '') : '';
  }
  document.querySelectorAll('[data-wa]').forEach(function (a) {
    var l = waLink('Olá! Gostaria de reservar uma mesa na Casa Bar Matriz.');
    if (l) { a.href = l; a.target = '_blank'; a.rel = 'noopener'; }
  });
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();

  // Menu mobile
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  function closeNav() { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Abrir menu'); }
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  // Entrada suave dos blocos
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // Reserva -> mensagem pronta no WhatsApp
  var form = document.getElementById('reserva');
  var msg = document.getElementById('formMsg');
  var hoje = new Date(); hoje.setMinutes(hoje.getMinutes() - hoje.getTimezoneOffset());
  form.elements.data.min = hoje.toISOString().slice(0, 10);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = form.elements, ok = true;
    ['nome', 'data', 'hora', 'pessoas'].forEach(function (n) {
      var bad = !f[n].value || (n === 'pessoas' && +f[n].value < 1);
      f[n].classList.toggle('bad', bad);
      if (bad) ok = false;
    });
    if (!ok) { msg.textContent = 'Preencha nome, data, horário e número de pessoas.'; return; }
    var d = f.data.value.split('-').reverse().join('/');
    var texto = 'Olá! Gostaria de reservar uma mesa na Casa Bar Matriz.\n' +
      'Nome: ' + f.nome.value.trim() + '\n' +
      'Data: ' + d + ' às ' + f.hora.value + '\n' +
      'Pessoas: ' + f.pessoas.value +
      (f.obs.value.trim() ? '\nObs.: ' + f.obs.value.trim() : '');
    var link = waLink(texto);
    if (!link) { msg.textContent = 'Reservas online serão ativadas em breve. Em breve divulgaremos o WhatsApp da casa.'; return; }
    msg.textContent = '';
    window.open(link, '_blank', 'noopener');
  });
})();
