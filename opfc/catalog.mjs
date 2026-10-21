/** OPMercato FC v0.8 — Catalogue officiel §§07–09.
 * Séparé du catalogue d'OPMercato classique.
 * Ordre statistique : PUI, TEC, PAS, VIT, DEF, GAR.
 */
const GROUPS=Object.freeze(['Chapeaux de paille','Empereurs','Corsaires','Supernovas','Légendes','Héritiers','Gouvernement']);
const RAW=`
luffy|Luffy|0|ATT|93|DIA|100|95|77|99|45|52
zoro|Zoro|0|ATT|90|OR|99|93|40|95|90|20
nami|Nami|0|MIL|72|BRZ|30|80|89|66|40|18
usopp|Usopp|0|MIL|67|BRZ|33|64|89|60|48|28
sanji|Sanji|0|ATT|89|OR|87|94|75|97|51|20
chopper|Chopper|0|GAR|80|ARG|75|65|54|77|72|83
robin|Robin|0|MIL|76|ARG|45|85|88|64|54|28
franky|Franky|0|GAR|83|ARG|95|52|62|53|83|84
brook|Brook|0|MIL|71|BRZ|35|82|73|93|35|16
jinbe|Jinbe|0|DEF|83|ARG|88|68|74|60|91|68
shanks|Shanks|1|MIL|95|DIA|90|98|98|93|86|30
kaido|Kaido|1|DEF|89|OR|99|76|58|83|94|54
big-mom|Big Mom|1|DEF|84|OR|99|65|48|58|94|58
barbe-noire|Barbe Noire|1|ATT|77|ARG|98|74|50|72|73|30
barbe-blanche|Barbe Blanche|1|DEF|91|OR|100|78|69|83|96|41
baggy|Baggy|1|GAR|64|BRZ|36|52|42|58|46|69
marco|Marco|1|DEF|81|ARG|78|79|71|94|81|63
ben-beckman|Ben Beckman|1|MIL|82|ARG|73|84|91|65|78|35
king|King|1|DEF|82|ARG|91|70|53|90|83|46
katakuri|Katakuri|1|MIL|87|OR|81|90|93|86|68|32
crocodile|Crocodile|2|MIL|78|ARG|69|79|91|62|63|20
hancock|Hancock|2|ATT|73|BRZ|70|84|42|81|32|20
gecko-moria|Gecko Moria|2|GAR|69|BRZ|69|53|45|45|70|70
doflamingo|Doflamingo|2|MIL|80|ARG|70|84|86|77|62|28
bartholomew-kuma|Bartholomew Kuma|2|GAR|90|OR|95|48|64|45|85|92
mihawk|Mihawk|2|DEF|90|OR|89|96|70|88|95|22
trafalgar-law|Trafalgar Law|3|MIL|89|OR|74|94|97|78|77|27
eustass-kidd|Eustass Kidd|3|ATT|84|OR|97|80|61|88|72|24
killer|Killer|3|DEF|74|BRZ|73|72|43|85|78|24
bonney|Bonney|3|ATT|69|BRZ|59|78|39|83|33|20
urouge|Urouge|3|DEF|72|BRZ|88|45|39|48|82|28
x-drake|X-Drake|3|DEF|73|BRZ|78|54|42|57|83|39
capone-bege|Capone Bege|3|GAR|74|BRZ|72|49|52|32|82|74
scratchmen-apoo|Scratchmen Apoo|3|MIL|59|BRZ|28|78|58|60|35|12
basil-hawkins|Basil Hawkins|3|GAR|72|BRZ|48|63|61|55|65|75
gol-d-roger|Gol D. Roger|4|ATT|96|DIA|99|97|86|98|78|25
rocks-d-xebec|Rocks D. Xebec|4|ATT|96|DIA|100|97|80|99|79|24
monkey-d-dragon|Monkey D. Dragon|4|MIL|88|OR|82|91|92|83|74|34
silvers-rayleigh|Silvers Rayleigh|4|DEF|81|ARG|81|86|76|78|82|34
kozuki-oden|Kozuki Oden|4|ATT|77|ARG|92|76|45|77|73|25
portgas-d-ace|Portgas D. Ace|5|ATT|78|ARG|86|81|54|81|52|22
sabo|Sabo|5|MIL|86|OR|87|88|88|85|73|28
yamato|Yamato|5|DEF|79|ARG|87|70|61|76|81|49
loki|Loki|5|GAR|92|DIA|96|59|62|45|90|94
monkey-d-garp|Monkey D. Garp|6|DEF|94|DIA|99|82|76|89|99|42
akainu|Akainu|6|ATT|85|OR|99|80|57|89|78|26
aokiji|Aokiji|6|GAR|88|OR|84|78|73|65|87|89
kizaru|Kizaru|6|ATT|79|ARG|72|73|67|100|48|18
koby|Koby|6|DEF|68|BRZ|54|55|57|83|72|25
rob-lucci|Rob Lucci|6|DEF|74|BRZ|78|75|40|90|74|25
ivankov|Ivankov|4|MIL|82|ARG|82|85|89|72|64|29
kinemon|Kinemon|5|MIL|79|ARG|79|76|82|75|84|22
bon-clay|Bon Clay|2|ATT|73|BRZ|54|87|57|86|30|12
vegapunk|Vegapunk|6|MIL|65|BRZ|22|76|92|27|35|14
kalgara|Kalgara|4|DEF|92|DIA|97|77|65|88|99|19
imu|Imu|6|MIL|98|DIA|98|99|98|98|96|55
dorry|Dorry|4|DEF|87|OR|97|54|52|66|99|21
brogy|Brogy|4|DEF|86|OR|99|58|50|55|100|18
vivi|Vivi|5|MIL|66|BRZ|25|75|80|65|35|17
ener|Ener|4|ATT|83|ARG|84|90|60|93|25|15
dadan|Dadan|5|GAR|70|BRZ|75|39|38|45|63|73
cesar-clown|César Clown|6|ATT|75|ARG|65|90|65|79|25|18
inuarashi|Inuarashi|5|ATT|85|OR|89|83|75|88|75|23
nekomamushi|Nekomamushi|5|ATT|88|OR|96|88|64|92|66|22
momonosuke|Momonosuké|5|GAR|77|ARG|62|51|58|70|67|80
`.trim();
const KEYS=['PUI','TEC','PAS','VIT','DEF','GAR'];
export const CARDS=Object.freeze(RAW.split('\n').map(line=>{
  const [id,name,groupIndex,position,rating,rarity,...values]=line.split('|');
  const stats=Object.freeze(Object.fromEntries(KEYS.map((k,i)=>[k,Number(values[i])])));
  return Object.freeze({id,name,group:GROUPS[Number(groupIndex)],position,rating:Number(rating),rarity,stats});
}));
export const CARD_BY_ID=new Map(CARDS.map(card=>[card.id,card]));
export const CLUBS=Object.freeze([
 Object.freeze({id:'PSG',name:'Pirates Saint-Grandline',colors:['#112c59','#ba1738','#ffffff']}),
 Object.freeze({id:'OM',name:'Olympique de MaryGeoise',colors:['#ffffff','#60b9db','#c4a062']})
]);
