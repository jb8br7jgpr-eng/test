/** Dessin EXACT des lignes du terrain de placement OPFC, partagé avec les aperçus de formation. */
export function pitchMarkings(){
 return '<div class="pitch-markings" aria-hidden="true">'+
 '<span class="pitch-outline"></span>'+
 '<span class="pitch-center-line"></span><span class="pitch-center-circle"></span><span class="pitch-center-spot"></span>'+
 '<span class="pitch-penalty-area pitch-penalty-top"></span><span class="pitch-penalty-area pitch-penalty-bottom"></span>'+
 '<span class="pitch-goal-area pitch-goal-area-top"></span><span class="pitch-goal-area pitch-goal-area-bottom"></span>'+
 '<span class="pitch-penalty-spot pitch-penalty-spot-top"></span><span class="pitch-penalty-spot pitch-penalty-spot-bottom"></span>'+
 '<span class="pitch-goal pitch-goal-top"></span><span class="pitch-goal pitch-goal-bottom"></span>'+
 '<span class="pitch-corner pitch-corner-tl"></span><span class="pitch-corner pitch-corner-tr"></span>'+
 '<span class="pitch-corner pitch-corner-bl"></span><span class="pitch-corner pitch-corner-br"></span>'+
 '</div>';
}
