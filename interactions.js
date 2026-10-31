(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const progress = document.querySelector(".scroll-progress");
  let scheduled = false;
  function updateProgress() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.width = (window.scrollY / max * 100) + "%";
    scheduled = false;
  }
  window.addEventListener("scroll", () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); } }, {passive:true});
  updateProgress();

  if (!reduce && "IntersectionObserver" in window) {
    const nodes = document.querySelectorAll(".block .section-head, .block .role, .cards .card, .expertise article, .cert, .playground-header");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    }, {threshold:0.08,rootMargin:"0px 0px -20px 0px"});
    nodes.forEach(n => { n.classList.add("reveal"); observer.observe(n); });
    document.body.classList.add("motion-ready");
  }

  const tilt = document.querySelector("[data-tilt]");
  if (tilt && !reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    tilt.addEventListener("pointermove", e => {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      tilt.style.setProperty("--tilt-x", (-y * 7).toFixed(2) + "deg");
      tilt.style.setProperty("--tilt-y", (x * 7).toFixed(2) + "deg");
    });
    tilt.addEventListener("pointerleave", () => {
      tilt.style.setProperty("--tilt-x","0deg");tilt.style.setProperty("--tilt-y","0deg");
    });
  }

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const value = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(b => {
        const active = b === button;
        b.classList.toggle("selected",active);
        b.setAttribute("aria-pressed",String(active));
      });
      document.querySelectorAll("#projects .card[data-category]").forEach(card => {
        card.hidden = value !== "all" && card.dataset.category !== value;
      });
    });
  });

  const stage = document.querySelector(".lab-stage");
  document.querySelectorAll("[data-mood]").forEach(button => {
    if (!button.classList.contains("mood")) return;
    button.addEventListener("click", () => {
      stage.dataset.mood = button.dataset.mood;
      document.querySelectorAll(".mood").forEach(b => {
        const active = b === button;
        b.classList.toggle("active",active);
        b.setAttribute("aria-pressed",String(active));
      });
    });
  });

  if (stage && !reduce && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    stage.addEventListener("pointermove", e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left)/r.width - .5;
      const y = (e.clientY - r.top)/r.height - .5;
      stage.querySelectorAll(".lab-pill").forEach((pill,i) => {
        pill.style.translate = (x * (i+1)*7) + "px " + (y*(i+1)*7) + "px";
      });
    });
    stage.addEventListener("pointerleave", () => {
      stage.querySelectorAll(".lab-pill").forEach(pill => pill.style.translate = "0 0");
    });
  }
})();
(() => {
 "use strict";
 const stage=document.querySelector('.glass-demo');
 const card=document.querySelector('.glass-specimen');
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.querySelectorAll('[data-glass]').forEach(button=>{
   button.addEventListener('click',()=>{
     stage.dataset.theme=button.dataset.glass;
     document.querySelectorAll('[data-glass]').forEach(b=>{
       const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
     });
   });
 });
 if(card&&!reduce&&matchMedia('(hover: hover) and (pointer: fine)').matches){
   card.addEventListener('pointermove',e=>{
     const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
     card.style.setProperty('--rx',((.5-y)*11).toFixed(2)+'deg');
     card.style.setProperty('--ry',((x-.5)*13).toFixed(2)+'deg');
     card.style.setProperty('--shine-x',(x*100).toFixed(0)+'%');
     card.style.setProperty('--shine-y',(y*100).toFixed(0)+'%');
   });
   card.addEventListener('pointerleave',()=>{card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg')});
 }
 document.querySelectorAll('.liquid-card').forEach(card=>{
   card.addEventListener('pointermove',e=>{
     const r=card.getBoundingClientRect();card.style.setProperty('--spot-x',(e.clientX-r.left)+'px');card.style.setProperty('--spot-y',(e.clientY-r.top)+'px');
   },{passive:true});
 });
})();

(() => {
  'use strict';
  const header=document.querySelector('header.top');
  const button=header?.querySelector('.mobile-menu-toggle');
  const nav=header?.querySelector('#primary-nav');
  if(!button||!nav)return;
  const mobile=matchMedia('(max-width:720px)');
  function setOpen(open,restoreFocus=false){
    header.classList.toggle('menu-open',Boolean(open));
    button.setAttribute('aria-expanded',String(Boolean(open)));
    if(restoreFocus)button.focus();
  }
  button.addEventListener('click',event=>{
    const open=button.getAttribute('aria-expanded')!=='true';setOpen(open);
    if(open&&event.detail===0)nav.querySelector('a')?.focus();
  });
  nav.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){setOpen(false,true);event.preventDefault();}
  });
  document.addEventListener('pointerdown',event=>{if(!header.contains(event.target))setOpen(false);},{passive:true});
  mobile.addEventListener('change',()=>{if(!mobile.matches)setOpen(false);});
})();