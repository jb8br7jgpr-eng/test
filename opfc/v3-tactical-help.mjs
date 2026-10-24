/** Aide purement informative, même matrice que opfc/open-play.mjs. */
export function v3HelpUi(open=false){
 return '<button type="button" class="v3-help-trigger" data-action="v3-help-toggle" aria-label="Aide tactique" aria-expanded="'+Boolean(open)+'" aria-controls="v3-tactics-dialog" title="Aide tactique">?</button>'+
 (open?'<div class="v3-help-overlay"><section id="v3-tactics-dialog" class="v3-help-dialog" role="dialog" aria-modal="true" aria-labelledby="v3-help-title">'+
 '<div class="v3-help-head"><h2 id="v3-help-title">📖 Aide tactique</h2><button type="button" data-action="v3-help-close" aria-label="Fermer l’aide">✕</button></div>'+
 '<p>Avantage de l’attaque selon la défense choisie :</p>'+
 '<div class="v3-help-scroll"><table><thead><tr><th>Attaque</th><th>Tacler</th><th>Intercepter</th><th>Pressing</th></tr></thead><tbody>'+
 '<tr><th>Passe courte</th><td class="plus">+8</td><td>0</td><td class="minus">−8</td></tr>'+
 '<tr><th>Passe en profondeur</th><td>0</td><td class="minus">−8</td><td class="plus">+8</td></tr>'+
 '<tr><th>Dribbler</th><td class="minus">−8</td><td class="plus">+8</td><td>0</td></tr>'+
 '</tbody></table></div><p class="v3-help-explain"><b>+8</b> avantage offensif · <b>−8</b> désavantage · <b>0</b> neutre. Ce sont des modificateurs tactiques, pas des pourcentages de réussite.</p>'+
 '<p><strong>Passe courte :</strong> finition par le porteur ou le partenaire (50/50).<br>'+
 '<strong>Passe en profondeur :</strong> finition par le partenaire.<br>'+
 '<strong>Dribbler :</strong> finition par le porteur.</p>'+
 '<p class="v3-help-explain">Rappel du jeu ouvert uniquement. Les corners, coups francs et tirs au but possèdent leurs propres règles.</p>'+
 '<button type="button" class="v3-help-dismiss" data-action="v3-help-close">Revenir au match</button></section></div>':'');
}
