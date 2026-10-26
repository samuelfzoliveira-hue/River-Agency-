const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('file://'+__dirname+'/Proposta_Vila_Animal.html');
// dispara observers
for(let y=0;y<20000;y+=500){await p.evaluate(y=>scrollTo(0,y),y);await p.waitForTimeout(60);}
await p.evaluate(()=>scrollTo(0,0));
// diagnóstico: score dos dois perfis
await p.evaluate(()=>scrollTo(0,document.querySelector('#scorePanel').offsetTop-200));
await p.click('#scoreTabs [data-p=vila]');await p.waitForTimeout(1800);
await p.evaluate(()=>{const pn=document.querySelector('#scorePanel');const c=pn.cloneNode(true);c.removeAttribute('id');c.style.marginTop='24px';c.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));pn.after(c);});
await p.click('#scoreTabs [data-p=verena]');await p.waitForTimeout(1800);
await p.evaluate(()=>{document.querySelector('#scoreTabs').style.display='none'});
// vazamentos: todas as linhas
const leaks=await p.evaluate(async()=>{const out=[];const chips=[...document.querySelectorAll('#leakChips button')];for(const c of chips){c.click();out.push('<div class="eyebrow" style="margin:18px 0 8px">'+c.textContent+'</div><div class="leak">'+document.querySelector('#leakView').innerHTML+'</div>');}
document.querySelector('#leakChips').style.display='none';document.querySelector('#leakView').outerHTML='<div>'+out.join('')+'</div>';return out.length});
// antes e depois: 2 perfis x 2 estados
const ba=await p.evaluate(async()=>{
 const res=[];
 for(const prof of ['verena','vila']){
  document.querySelector('#baProfile [data-p='+prof+']').click();
  const row=[];
  for(const st of [0,1]){
    if(st===1)document.querySelector('#baToggle').click();
    const ph=document.querySelector('.phone').cloneNode(true);ph.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
    row.push(ph.outerHTML);
    if(st===1)row.push('<div>'+document.querySelector('#baChanges').innerHTML.replace(/opacity:[0-9.]+/g,'opacity:1')+'</div>');
  }
  res.push('<div class="bapf" style="display:block;break-inside:avoid;margin-bottom:50px"><div class="eyebrow" style="margin:30px 0 24px">@'+(prof==='verena'?'draverenamartineza':'vilaanimalvdc')+'</div><div style="display:grid;grid-template-columns:290px 290px minmax(0,1fr);gap:34px;align-items:start">'+row.join('')+'</div></div>');
 }
 const wrap=document.querySelector('#simulacao .ba');wrap.outerHTML='<div style="display:block">'+res.join('')+'</div>';
 document.querySelector('#baProfile').style.display='none';
 return res.length;});
console.log(leaks,ba);
// etapas e cronograma
await p.evaluate(()=>{document.querySelectorAll('.step').forEach(s=>s.classList.add('on'));document.getElementById('railFill').style.width='100%';
 document.querySelectorAll('.rv').forEach(e=>e.classList.add('in'));
 document.querySelectorAll('.bar i').forEach(i=>i.style.width=i.dataset.w+'%');});
await p.addStyleTag({content:`
 nav,.fab,.progress,.scroll-hint,.rings{display:none!important}
 *{-webkit-print-color-adjust:exact;print-color-adjust:exact;animation:none!important}
 .rv{opacity:1!important;transform:none!important}
 section{padding:56px 0!important;break-before:page}
 #investimento{break-before:page}
 .gain{break-inside:avoid}
 #mensal{break-after:page}
 .foot{break-before:avoid}
 .hero{min-height:auto!important;padding:90px 0!important}
 .card,.role,.str,.change,.gain .c,.gain .big,.week,.step,.opt,.pay>div,.ramp div,.leak,.feat button,.mock,.phone,.score-panel,.total,.why .card,.next>div{break-inside:avoid}
 .total{position:static!important}
 .tablewrap,.pay,.ramp{break-inside:avoid}
 .eyebrow,h2,h3{break-after:avoid}
 #investimento{padding-top:56px!important;break-inside:avoid}
`});
await p.emulateMedia({media:'screen'});
await p.pdf({path:__dirname+'/Proposta_Vila_Animal.pdf',width:'1200px',height:'1500px',printBackground:true,margin:{top:'0',bottom:'0',left:'0',right:'0'}});
await b.close();})()
