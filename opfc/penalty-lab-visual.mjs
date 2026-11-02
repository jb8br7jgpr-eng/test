/** OPFC labo V2 : SVG décoratifs, sans règles ni données. */
export function labPitchGraphic(){
 let mesh='';
 for(let i=0;i<=17;i++){
  const t=i/17, top=88+184*t,base=65+230*t;
  mesh+='<path d="M'+top.toFixed(1)+' 30 Q'+(base+3*(.5-t)).toFixed(1)+' 73 '+base.toFixed(1)+' 108"/>';
 }
 for(let i=0;i<=11;i++){
  const t=i/11,y=30+78*t,a=88-23*t,b=272+23*t;
  mesh+='<path d="M'+a.toFixed(1)+' '+y.toFixed(1)+' Q180 '+(y+Math.sin(Math.PI*t)*4).toFixed(1)+' '+b.toFixed(1)+' '+y.toFixed(1)+'"/>';
 }
 return '<svg class="plab-lines" viewBox="0 0 360 365" preserveAspectRatio="none" aria-hidden="true">'+
  '<defs>'+
  '<linearGradient id="plab-metal" x1="0" x2="1" y1="0" y2=".35"><stop stop-color="#a1b7bf"/><stop offset=".28" stop-color="#fff"/><stop offset=".7" stop-color="#f5f9fa"/><stop offset="1" stop-color="#a6b8bd"/></linearGradient>'+
  '<radialGradient id="plab-goalshade"><stop stop-color="#e8f7ff" stop-opacity=".25"/><stop offset="1" stop-color="#061c21" stop-opacity=".36"/></radialGradient>'+
  '<pattern id="plab-blades" width="19" height="17" patternUnits="userSpaceOnUse"><g stroke="#ceefb5" opacity=".22" stroke-width=".5"><path d="M3 8l1 -3 M11 14l2 -4 M18 4l-1 -3 M6 16l1 -2"/></g><path d="M8 4l1 -2 M15 9l-1 -3" stroke="#102d1b" stroke-width=".6" opacity=".3"/></pattern>'+
  '</defs>'+
  '<rect x="0" y="57" width="360" height="308" fill="url(#plab-blades)"/>'+
  '<ellipse cx="180" cy="112" rx="130" ry="14" fill="#082b20" opacity=".55"/>'+
  '<path d="M65 108 L88 30 H272 L295 108 Z" fill="url(#plab-goalshade)" stroke="#f7ffff" stroke-opacity=".28"/>'+
  '<path d="M65 50 L88 30 H272 L295 50" fill="none" stroke="#e1f0f3" stroke-width="1.5" opacity=".6"/>'+
  '<g class="plab-net-mesh" fill="none" stroke="#e8f4f8" stroke-width=".68" stroke-opacity=".58">'+mesh+'</g>'+
  '<path d="M65 108 V50 H295 V108" fill="none" stroke="#092830" stroke-width="10" opacity=".72"/>'+
  '<path d="M65 108 V50 H295 V108" fill="none" stroke="url(#plab-metal)" stroke-width="6.6" stroke-linejoin="round"/>'+
  '<path d="M63 107 V48 H294" fill="none" stroke="#fff" stroke-width="1.3" opacity=".65"/>'+
  '<path d="M65 108 L7 297 H353 L295 108 M118 108 L100 169 H260 L242 108 M135 297 Q180 352 225 297" fill="none" stroke="#06291c" stroke-width="4.5" opacity=".38"/>'+
  '<path d="M65 108 L7 297 H353 L295 108 M118 108 L100 169 H260 L242 108 M135 297 Q180 352 225 297" fill="none" stroke="#f6fff6" stroke-width="1.9" stroke-linejoin="round" opacity=".90"/>'+
  '<circle cx="180" cy="248" r="4" fill="#f3fff3"/><circle cx="180" cy="248" r="1.6" fill="#cde7cf"/>'+
  '<path d="M0 345 H360" stroke="#edffed" stroke-width="1" opacity=".16"/>'+
 '</svg>';
}
export function labBallGraphic(){
 return '<svg class="plab-ball-art" viewBox="0 0 100 100" aria-hidden="true">'+
  '<defs><radialGradient id="plab-ball-mat" cx="30%" cy="22%" r="82%"><stop stop-color="#fff"/><stop offset=".48" stop-color="#f6f8f5"/><stop offset=".78" stop-color="#d4dddc"/><stop offset="1" stop-color="#849aa1"/></radialGradient>'+
  '<radialGradient id="plab-ball-gloss" cx="22%" cy="16%" r="64%"><stop stop-color="#fff" stop-opacity=".78"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'+
  '<clipPath id="plab-ball-mask"><circle cx="50" cy="50" r="47"/></clipPath></defs>'+
  '<circle cx="50" cy="50" r="48" fill="#23343c"/><circle cx="50" cy="50" r="47" fill="url(#plab-ball-mat)"/>'+
  '<g clip-path="url(#plab-ball-mask)" stroke="#5b737a" stroke-width="1.2" stroke-linejoin="round">'+
  '<path d="M35 32 L55 24 L75 39 L71 60 L51 72 L30 60 L25 43Z" fill="#18262e" stroke="#233740" stroke-width="2"/>'+
  '<path d="M25 43 L0 33 L8 10 L32 10 L55 24 L35 32Z" fill="#f4f6f3"/>'+
  '<path d="M55 24 L74 5 L100 16 L100 42 L75 39Z" fill="#17252c"/>'+
  '<path d="M75 39 L100 42 L100 71 L83 79 L71 60Z" fill="#edf1ee"/>'+
  '<path d="M71 60 L83 79 L69 105 L45 100 L51 72Z" fill="#1d2c33"/>'+
  '<path d="M51 72 L45 100 L17 100 L4 76 L30 60Z" fill="#e5ece8"/>'+
  '<path d="M30 60 L4 76 L-5 57 L0 33 L25 43Z" fill="#202e34"/>'+
  '<path d="M32 10 L41 -5 L74 5 L55 24Z" fill="#ecf1ed"/>'+
  '<path d="M8 10 L-5 4 L-4 33 L0 33Z" fill="#2c3940"/>'+
  '</g><circle cx="50" cy="50" r="47" fill="url(#plab-ball-gloss)"/>'+
  '<circle cx="50" cy="50" r="46.5" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" fill="none"/>'+
  '<path d="M13 37 Q24 14 44 11" fill="none" stroke="#fff" opacity=".55" stroke-width="3" stroke-linecap="round"/>'+
 '</svg>';
}
