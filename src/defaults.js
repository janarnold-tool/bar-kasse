// Startsortiment (Stand 2025). Preise in Rappen.
export const DEFAULT_CATEGORIES = [
  { id: 'c-alkoholfrei', name: 'Alkoholfrei', color: '#1f7ae0', order: 1 },
  { id: 'c-leicht', name: 'Leichter Alkohol', color: '#d98a00', order: 2 },
  { id: 'c-cocktails', name: 'Cocktails', color: '#c2337a', order: 3 },
  { id: 'c-mocktails', name: 'Mocktails', color: '#2e9e52', order: 4 },
  { id: 'c-shots', name: 'Shots', color: '#7b4fd6', order: 5 },
];

const p = (id, name, price, category, icon, order) => ({ id, name, price, category, icon, order });

export const DEFAULT_PRODUCTS = [
  p('p-cola', 'Coca-Cola 3dl', 300, 'c-alkoholfrei', 'logo:coca-cola.png', 1),
  p('p-mate', 'El Tony Mate 3.3dl', 600, 'c-alkoholfrei', 'logo:el-tony.png', 2),
  p('p-wasser-laut', 'Wasser laut 3dl', 250, 'c-alkoholfrei', 'logo:wasser-laut.svg', 3),
  p('p-wasser-still', 'Wasser still 3dl', 250, 'c-alkoholfrei', 'logo:wasser-still.svg', 4),
  p('p-rivella', 'Rivella Rot 3dl', 300, 'c-alkoholfrei', 'logo:rivella.png', 5),
  p('p-spezli', 'Schützengarten Lager Spezli 3.3dl', 600, 'c-leicht', 'logo:schuetzengarten.png', 1),
  p('p-weisswein', 'Weisswein 1dl', 600, 'c-leicht', 'logo:weisswein.svg', 2),
  p('p-appenzeller-rocks', 'Appenzeller on the Rocks 2dl', 800, 'c-cocktails', 'logo:appenzeller.png', 1),
  p('p-gin-tonic', 'Gin Tonic 3dl', 800, 'c-cocktails', 'logo:gin-tonic.svg', 2),
  p('p-aperol', 'Aperol Spritz 3dl', 1000, 'c-cocktails', 'logo:aperol-spritz.svg', 3),
  p('p-lillet', 'Wildberry Lillet 3dl', 1000, 'c-cocktails', 'logo:wildberry-lillet.svg', 4),
  p('p-hugo', 'Hugo 3dl', 1000, 'c-cocktails', 'logo:hugo.svg', 5),
  p('p-turbo-tony', 'Turbo Tony', 1000, 'c-cocktails', 'logo:turbo-tony.svg', 6),
  p('p-hugo-af', 'Alkoholfreier Hugo 3dl', 800, 'c-mocktails', 'logo:hugo-alkoholfrei.svg', 1),
  p('p-virgin-sunrise', 'Virgin Sunrise 3dl', 600, 'c-mocktails', 'logo:virgin-sunrise.svg', 2),
  p('p-bluesblaster', 'BluesBlaster 2cl', 500, 'c-shots', 'logo:bluesblaster.svg', 1),
  p('p-appenzeller-shot', 'Appenzeller 2cl', 500, 'c-shots', 'logo:appenzeller.png', 2),
  p('p-shotbrettli', 'Shotbrettli (10 Shots)', 4000, 'c-shots', 'logo:shotbrettli.svg', 3),
];

export const ICON_CHOICES = ['🥤','🧉','💧','🫧','🧃','🍺','🍻','🥂','🍷','🍾','🥃','🍸','🍹','🍓','🌿','🍃','⚡','🌅','🍋','🍊','🍒','🫐','🥥','☕','🍵','🎷','🎺','🎵','🔥','🔟','🧊','🥨','🍿','🌭','🍰'];

export const COLOR_CHOICES = ['#1f7ae0','#0e9aa7','#2e9e52','#7a9a01','#d98a00','#e0561f','#d63c3c','#c2337a','#7b4fd6','#5b6474'];
