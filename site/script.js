const menu=document.querySelector('.menu-button'),links=document.querySelector('.nav-links');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));links.classList.toggle('open',!open)});
document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>{menu?.setAttribute('aria-expanded','false');links?.classList.remove('open')}));
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(e=>observer.observe(e));
document.querySelectorAll('.change').forEach(c=>{c.querySelector('.accept')?.addEventListener('click',()=>{c.classList.add('accepted');c.querySelector('.accept').textContent='✓ Accepted'});c.querySelector('button:not(.accept)')?.addEventListener('click',()=>{c.classList.add('rejected');c.querySelector('button:not(.accept)').textContent='↩ Rejected'})});
document.querySelector('.accept-all')?.addEventListener('click',e=>{document.querySelectorAll('.change:not(.accepted):not(.rejected)').forEach(c=>c.classList.add('accepted'));e.currentTarget.textContent='✓ All formatting accepted'});
