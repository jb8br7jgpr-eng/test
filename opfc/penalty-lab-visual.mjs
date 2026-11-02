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
/** Ballon noir et blanc classique conforme à la référence de l'utilisateur.
 * Pentagone noir en haut au centre, large hexagone blanc sous celui-ci,
 * coutures et autres pentagones noirs sur les bords. */
export function labBallGraphic(){
 return '<svg class="plab-ball-art" viewBox="0 0 100 100" aria-hidden="true">'+
 '<defs>'+
 '<radialGradient id="plab-ball-mat" cx="31%" cy="23%" r="85%">'+
 '<stop offset="0" stop-color="#fff"/><stop offset=".48" stop-color="#f7f7f4"/>'+
 '<stop offset=".78" stop-color="#d5d6d2"/><stop offset="1" stop-color="#969e9e"/></radialGradient>'+
 '<linearGradient id="plab-ball-black" x1="0" y1="0" x2=".72" y2="1">'+
 '<stop stop-color="#08090b"/><stop offset=".6" stop-color="#121416"/><stop offset="1" stop-color="#3a3b3b"/></linearGradient>'+
 '<radialGradient id="plab-ball-light" cx="28%" cy="19%" r="75%">'+
 '<stop stop-color="#fff" stop-opacity=".74"/><stop offset=".58" stop-color="#fff" stop-opacity=".06"/>'+
 '<stop offset="1" stop-color="#17252d" stop-opacity=".28"/></radialGradient>'+
 '<clipPath id="plab-ball-mask"><circle cx="50" cy="50" r="48"/></clipPath>'+
 '</defs>'+
 '<circle cx="50" cy="50" r="49" fill="#d7dedc"/>'+
 '<circle cx="50" cy="50" r="48" fill="url(#plab-ball-mat)"/>'+
 '<g clip-path="url(#plab-ball-mask)" stroke="#b6bcb8" stroke-width=".9" stroke-linejoin="round">'+
 // Bottom large white hexagon, authentic black pentagons above and at bottom sides.
 '<path d="M34 46 L65 46 L78 65 L65 84 L40 84 L24 65 Z" fill="#f2f2ef"/>'+
 '<path d="M33 21 L47 13 L67 22 L66 46 L34 46 L29 30 Z" fill="url(#plab-ball-black)" stroke="#3e4242" stroke-width="1"/>'+
 '<path d="M3 39 L10 18 L25 8 L25 13 L17 41 L8 47 Z" fill="url(#plab-ball-black)"/>'+
 '<path d="M73 8 L87 17 L100 41 L91 48 L83 40 L77 19 Z" fill="url(#plab-ball-black)"/>'+
 '<path d="M1 62 L24 65 L40 84 L27 99 L9 88 Z" fill="url(#plab-ball-black)"/>'+
 '<path d="M78 65 L100 63 L100 87 L78 99 L65 84 Z" fill="url(#plab-ball-black)"/>'+
 '<path d="M25 8 L47 2 L73 8 L67 22 L47 13 L33 21 L25 13 Z" fill="#f2f3f0"/>'+
 '<path d="M3 39 L17 41 L29 30 L34 46 L24 65 L1 62 Z" fill="#e9eae7"/>'+
 '<path d="M67 22 L77 19 L83 40 L91 48 L100 63 L78 65 L65 46 Z" fill="#f8f8f6"/>'+
 '<path d="M9 88 L27 99 L78 99 L65 84 L40 84 Z" fill="#e2e5e0"/>'+
 '</g>'+
 // Fine stitched seams along the panel edges, not a hexagon decoration.
 '<g clip-path="url(#plab-ball-mask)" fill="none" stroke="#939b99" stroke-width=".56" stroke-linecap="round" stroke-linejoin="round">'+
 '<path d="M34 46 L65 46 L78 65 L65 84 L40 84 L24 65 Z"/>'+
 '<path d="M33 21 L47 13 L67 22 L66 46 L34 46 L29 30 Z"/>'+
 '<path d="M24 65 L1 62 M78 65 L100 63 M40 84 L27 99 M65 84 L78 99"/>'+
 '<path d="M17 41 L3 39 M83 40 L91 48 M25 13 L25 8 M73 8 L77 19"/>'+
 '</g>'+
 '<g clip-path="url(#plab-ball-mask)" fill="none" stroke="#5d696b" stroke-width=".34" stroke-dasharray=".9 1.1" opacity=".62">'+
 '<path d="M34 45 L65 45 L77 65 L64 83 L41 83 L25 65 Z"/>'+
 '<path d="M34 22 L47 14 L66 23 L65 45 L35 45 L30 30 Z"/>'+
 '</g>'+
 '<circle cx="50" cy="50" r="48" fill="url(#plab-ball-light)"/>'+
 '<circle cx="50" cy="50" r="47.5" stroke="#fdfefe" stroke-opacity=".48" stroke-width=".8" fill="none"/>'+
 '</svg>';
}
