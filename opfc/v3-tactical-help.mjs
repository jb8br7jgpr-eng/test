/** Read-only in-match manual. Category pages, never accordions.
 * Values reflect open-play.mjs; explanations never reveal hidden selections.
 */
const ITEMS=[
 ['start','▶','Bien débuter','Étapes du match et qualités d’occasion'],
 ['duels','⚔','Attaque et défense','Choix tactiques et matrice'],
 ['shots','🎯','Tirs et gardiens','Frappes, arrêts et tir conseillé'],
 ['setpieces','🚩','Coups francs et corners','Gestes et réponses défensives'],
 ['penalties','🥅','Penaltys et tirs au but','Zones et déroulement des séances'],
 ['lineups','👥','Personnages et compositions','Notes, postes et mi-temps'],
 ['modes','🌐','Modes local et en ligne','Choix secrets et validations']
];
const header=(title,lead)=>'<p class="v3-guide-lead">'+lead+'</p>';
const table=(head,rows)=>'<div class="v3-guide-table-wrap"><table><thead><tr>'+
 head.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(row=>'<tr>'+row.map((cell,i)=>'<'+(i?'td':'th')+'>'+cell+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+
 '</tbody></table></div>';
const tip=s=>'<div class="v3-guide-tip"><strong>💡 À retenir</strong><p>'+s+'</p></div>';
const pct=s=>'<p class="v3-guide-note">'+s+'</p>';
function detail(id){
 switch(id){
 case 'start':return header('','Chaque rencontre oppose deux équipes de sept joueurs. Les occasions se succèdent jusqu’au résultat final.')+
 table(['Étape','À faire'],[
 ['Avant-match','Observer le stade, les clubs et les compositions.'],
 ['Jeu ouvert','L’attaquant et le défenseur choisissent secrètement leurs actions.'],
 ['Finition','Si une occasion est créée, le tireur défie le gardien.'],
 ['Mi-temps','Ajuster les compositions, puis les valider.'],
 ['Fin de match','Retrouver score, buteurs, statistiques et trophée.']])+
 table(['Statistique','Ce qu’elle mesure'],[
 ['Tirs','Tentatives de tir pendant le temps réglementaire.'],
 ['Tirs cadrés','Frappes qui finissent au but ou sont arrêtées par le gardien.'],
 ['Arrêts','Tirs cadrés repoussés par le gardien.']])+
 tip('Les occasions franches (vert), bonnes (orange) et difficiles (rouge) indiquent la qualité de la situation. La couleur ne garantit jamais un but.');
 case 'duels':return header('','Les deux joueurs choisissent leur tactique sans connaître celle de l’autre. Le tableau indique le modificateur pour l’attaque.')+
 table(['Attaque','Tacler','Intercepter','Pressing'],[
 ['Passe courte','<b class="plus">+8</b>','0','<b class="minus">−8</b>'],
 ['Passe en profondeur','0','<b class="minus">−8</b>','<b class="plus">+8</b>'],
 ['Dribbler','<b class="minus">−8</b>','<b class="plus">+8</b>','0']])+
 pct('+8 : avantage offensif · −8 : désavantage · 0 : neutre. Ce ne sont pas des pourcentages.')+
 table(['Attaque','Qui pourra finir ?'],[
 ['Passe courte','Le porteur ou son partenaire (50/50)'],
 ['Passe en profondeur','Le partenaire'],
 ['Dribbler','Le porteur']])+
 tip('Exemple : une passe courte face à Tacler bénéficie d’un bonus tactique de +8, mais peut tout de même échouer.');
 case 'shots':return header('','Après une occasion créée, le tireur choisit son geste et le gardien choisit sa réaction. Les statistiques des joueurs et la difficulté de l’occasion comptent aussi.')+
 table(['Frappe','Réaction qui la contre'],[
 ['Frappe placée','Réduire l’angle'],
 ['Frappe puissante','Plongeon anticipé'],
 ['Ballon piqué','Rester sur sa ligne']])+
 tip('L’étoile « Tir conseillé » indique une recommandation calculée à partir des joueurs et du contexte. Elle ne révèle pas le choix secret du gardien.')+
 pct('Les avantages du gardien ne garantissent pas un arrêt, et une frappe non conseillée peut marquer.');
 case 'setpieces':return header('','Les coups francs et les corners ont des choix différents du jeu ouvert. Le tireur et la défense choisissent leurs actions.')+
 '<h3>Coups francs</h3>'+
 table(['Attaque','Réponse défensive adaptée'],[
 ['Frappe directe','Renforcer le mur'],
 ['Centre','Marquage serré'],
 ['Combinaison courte','Anticiper']])+
 '<h3>Corners</h3>'+
 table(['Zone visée','Zone à couvrir'],[
 ['Premier poteau','Couvrir le premier poteau'],
 ['Point de penalty','Couvrir le point de penalty'],
 ['Second poteau','Couvrir le second poteau']])+
 pct('Si la défense couvre la zone choisie, elle réduit les chances de créer une occasion. Si le centre réussit, le réceptionneur choisit sa finition.')+
 table(['Finition de corner','Choix du réceptionneur'],[
 ['Tête','Jeu de tête.'],
 ['Reprise de volée','Frappe avant que le ballon touche le sol.'],
 ['Retourné acrobatique','Geste spectaculaire plus risqué.']])+
 tip('Après un centre réussi sur corner, le réceptionneur choisit son geste : il n’y a pas de second choix tactique du gardien.');
 case 'penalties':return header('','Les penalties et les séances de tirs au but reposent sur un choix de zone, effectué séparément par le tireur et le gardien.')+
 table(['Tireur','Gardien'],[
 ['Gauche, centre ou droite','Plonger à gauche, rester au centre ou plonger à droite'],
 ['Choix secret','Choix secret jusqu’à la résolution']])+
 tip('Le gardien tente d’anticiper la zone du tir. Même lorsque la direction est correcte, le résultat n’est pas automatiquement un arrêt.')+
 pct('Pendant une séance, chaque camp dispose de cinq tentatives initiales. En cas d’égalité, la mort subite départage les clubs. Le suivi affiche les buts, arrêts et tirs manqués.');
 case 'lineups':return header('','Chaque équipe dispose de sept joueurs placés sur le terrain. Leur position et leurs statistiques influencent les actions du match.')+
 table(['Élément','Signification'],[
 ['Note effective','Note du joueur à son poste actuel.'],
 ['Poste naturel','Poste préféré du personnage.'],
 ['Hors poste !','Le joueur peut subir un malus de performance.'],
 ['Formation','Répartition des joueurs sur le terrain.'],
 ['Mi-temps','Moment où les postes et formations peuvent être ajustés.']])+
 tip('Place autant que possible les joueurs à leur poste naturel. Les changements autorisés à la mi-temps n’effacent pas les actions de la première période.');
 case 'modes':return header('','Les décisions tactiques doivent rester confidentielles, en local comme en ligne.')+
 table(['Mode','Comment ça marche'],[
 ['Local','Les deux joueurs utilisent le même appareil, chacun à son tour.'],
 ['En ligne','Chaque joueur choisit depuis son propre appareil.'],
 ['Confidentialité','Ne pas dévoiler un choix avant la résolution.'],
 ['Continuer','Certaines étapes demandent une validation des deux joueurs.'],
 ['En attente','L’écran n’avance pas tant que l’autre joueur n’a pas confirmé.']])+
 tip('Si l’autre téléphone réfléchit ou n’a pas validé « Continuer », patiente : ton choix ne doit pas s’afficher chez lui.');
 default:return '';
 }
}
export const GUIDE_CATEGORIES=Object.freeze(ITEMS.map(([id])=>id));
export function suggestedGuideCategory(state){
 const phase=state?.phase,action=state?.match?.action||{},kind=action.kind??state?.match?.currentMoment?.type;
 if(phase==='shootout'||phase==='shootout-ready'||kind==='penalty')return 'penalties';
 if(phase==='half-time'||phase==='resume-ready')return 'lineups';
 if(kind==='corner'||kind==='free-kick')return 'setpieces';
 if(action.stage?.startsWith('shot-')||phase==='moment-result'&&['goal','save','miss'].includes(state?.match?.lastResult?.outcome))return 'shots';
 if(kind==='open')return 'duels';
 return 'start';
}
export function v3HelpUi(open=false,selected=null,suggested=null){
 if(!open)return '';
 const current=ITEMS.find(item=>item[0]===selected);
 const body=current?
  '<button class="v3-help-back" type="button" data-action="v3-help-menu">← Toutes les rubriques</button>'+
  '<h3 class="v3-guide-section-heading">'+current[1]+' '+current[2]+'</h3>'+
  detail(current[0]):
  '<p class="v3-guide-lead">Choisis une rubrique pour découvrir ses explications, ses tableaux et des exemples.</p>'+
  '<div class="v3-guide-tiles">'+ITEMS.map(([id,emoji,title,desc])=>
    '<button class="v3-guide-tile" type="button" data-action="v3-help-category" data-category="'+id+'">'+
    '<span class="v3-guide-tile-icon" aria-hidden="true">'+emoji+'</span>'+
    '<span class="v3-guide-tile-label"><strong>'+title+'</strong><small>'+desc+'</small>'+
    (id===suggested?'<em>Conseillé pour cette action</em>':'')+'</span>'+
    '<span class="v3-guide-chevron" aria-hidden="true">›</span></button>').join('')+'</div>';
 return '<div class="v3-help-overlay"><section id="v3-tactics-dialog" class="v3-help-dialog" role="dialog" aria-modal="true" aria-labelledby="v3-help-title">'+
  '<div class="v3-help-head"><div><h2 id="v3-help-title">📖 GUIDE OPFC</h2><p>Comprendre et maîtriser le jeu</p></div>'+
  '<button type="button" data-action="v3-help-close" aria-label="Fermer l’aide">✕</button></div>'+
  '<div class="v3-guide-body">'+body+'</div>'+
  '<button type="button" class="v3-help-dismiss" data-action="v3-help-close">Revenir au match</button></section></div>';
}
