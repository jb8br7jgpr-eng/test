/**
 * OPFC labo V5 — cadrage de caméra uniquement.
 *
 * But : avancer visuellement la cage de ~11 % et descendre très légèrement
 * le point de vue. Le ballon, les portraits, les choix tactiques et les
 * positions finales renvoyées par trajectoryFor() restent intacts.
 *
 * Le fond rectangulaire derrière la cage reçoit un emplacement dédié pour
 * les futures illustrations des huit stades, sans illustration inventée.
 *
 * Ce module ne sera jamais importé par le jeu principal avant validation.
 */
import {labV4PitchGraphic} from './penalty-lab-v4.mjs';

export const LAB_V5_CAMERA=Object.freeze({
 goalScaleX:1.115,
 goalScaleY:1.105,
 goalLeft:52,
 goalRight:308,
 goalBaseY:119,
 backgroundHeightPercent:28,
 ballYPercent:68,
 shooterYPercent:85
});

const LINE_OLD='M65 108 L7 297 H353 L295 108 M118 108 L100 169 H260 L242 108 M135 297 Q180 352 225 297';
const LINE_V5='M52 119 L7 297 H353 L308 119 M112 119 L96 175 H264 L248 119 M135 297 Q180 352 225 297';

/**
 * Agrandit uniquement l'ensemble physique de la cage et de son filet.
 * La transformation statique englobe les trois zones animées du filet V4 :
 * leurs proportions et leurs animations restent identiques.
 *
 * Les marquages au sol sont alignés avec les nouveaux montants de la cage ;
 * le point de penalty et l'orientation des tirs ne changent pas.
 */
export function labV5PitchGraphic(){
 const svg=labV4PitchGraphic();
 const first=svg.indexOf('<ellipse cx="180" cy="112"');
 const final=svg.indexOf('<path d="M63 107 V48 H294"');
 const end=final>=0?svg.indexOf('/>',final)+2:-1;
 if(first<0||final<first||end<final+3)
  throw Error('Repères de la cage V4 introuvables');

 const scale='translate(180 0) scale('+LAB_V5_CAMERA.goalScaleX+' '+LAB_V5_CAMERA.goalScaleY+') translate(-180 0)';
 const cage='<g class="plab-v5-goal-group" transform="'+scale+'">'+svg.slice(first,end)+'</g>';
 const updated=svg.slice(0,first)+cage+svg.slice(end);
 const count=updated.split(LINE_OLD).length-1;
 if(count!==2)throw Error('Marquages de surface V4 modifiés : adaptation V5 impossible');
 return updated.replaceAll(LINE_OLD,LINE_V5);
}
