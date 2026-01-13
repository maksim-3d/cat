const fs = require('fs');

// Читаем cats_data.json
const catsData = JSON.parse(fs.readFileSync('api/data/cats_data.json', 'utf8'));

// Преобразуем в формат stats.json
const stats = {
  stats: {
    total_players: catsData.total_players || 0,
    total_cats: catsData.total_cats || 0,
    total_matroskin: catsData.total_matroskin || 0,
    total_attacks: catsData.total_attacks || 0
  },
  timestamp: new Date().toISOString(),
  source: "cats_data.json"
};

// Записываем в stats.json
fs.writeFileSync('stats.json', JSON.stringify(stats, null, 2));

console.log('✅ stats.json обновлен из cats_data.json');
console.log('📊 Игроков:', stats.stats.total_players);
console.log('🐱 Кошек:', stats.stats.total_cats);