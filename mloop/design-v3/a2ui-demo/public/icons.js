const paths = {
  sparkles:'m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3ZM20 2v4m-2-2h4M4 17v5m-2-2.5h4',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  chart:'M4 3v17h17M8 15l4-5 4 3 5-8',
  arrowUp:'m7 14 5-5 5 5M12 9v11', arrowRight:'M4 12h16m-6-6 6 6-6 6', arrowDown:'M12 4v16m-6-6 6 6 6-6',
  check:'m5 12 4 4L19 6', close:'m6 6 12 12M6 18 18 6', plus:'M12 5v14M5 12h14',
  calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z',
  clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M12 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm4-3.9a4 4 0 0 1 0 7.8',
  bag:'M5 7h14l2 14H3L5 7Zm3 0V6a4 4 0 0 1 8 0v1',
  code:'m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18',
  mobile:'M7 2h10v20H7zM11 18h2', monitor:'M3 3h18v14H3zM8 21h8m-4-4v4',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  layers:'m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon:'M20 14.5A9 9 0 0 1 9.5 4 9 9 0 1 0 20 14.5Z',
  coffee:'M4 8h12v7a5 5 0 0 1-10 0V8Zm12 1h2a3 3 0 0 1 0 6h-2M8 2v3m4-3v3M3 22h16',
  mail:'M3 5h18v14H3zM3 5l9 8 9-8', star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  info:'M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  leaf:'M20 3C9 1 2 8 5 15s16 5 15-12ZM4 21 15 10',
  headphones:'M4 14v-3a8 8 0 0 1 16 0v3M4 12h4v9H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 1-2Zm16 0h-4v9h3a2 2 0 0 0 2-2v-5a2 2 0 0 0-1-2Z',
  speaker:'M6 2h12v20H6zM15 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM11 6h2',
  copy:'M8 8h13v13H8zM4 16H2V2h14v2', refresh:'M20 7V2m0 5h-5M4 17v5m0-5h5M4 9a8 8 0 0 1 13-5l3 3M4 17l3 3a8 8 0 0 0 13-5',
};
const aliases={check:'check',add:'plus',close:'close',star:'star',favorite:'heart',shoppingCart:'bag',calendarToday:'calendar',event:'calendar',mail:'mail',person:'people',accountCircle:'people',search:'search',info:'info',home:'grid',arrowForward:'arrowRight',arrowBack:'arrowRight',download:'download',locationOn:'pin',send:'arrowUp',refresh:'refresh',photo:'layers',payment:'bag',warning:'info'};
export function icon(name, size=18) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
  const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]||paths[aliases[name]]||paths.layers);svg.append(p);return svg;
}
export function hydrateIcons(root=document) {for(const n of root.querySelectorAll('[data-icon]')) n.replaceChildren(icon(n.dataset.icon,Number(n.dataset.size)||18));}
