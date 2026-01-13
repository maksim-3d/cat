const http = require('http');
const fs = require('fs');

const server = http.createServer(async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.url === '/api/stats' && req.method === 'GET') {
    try {
      // Читаем cats_data.json
      const catsData = JSON.parse(fs.readFileSync('cats_data.json', 'utf8'));
      
      // РАССЧИТЫВАЕМ статистику из данных игроков
      let total_players = 0;
      let total_cats = 0;
      let total_matroskin = 0;
      let total_attacks = 0;
      let total_successful_attacks = 0;
      
      // Проходим по всем игрокам
      for (const playerId in catsData) {
        const player = catsData[playerId];
        total_players++;
        total_cats += player.cats || 0;
        total_matroskin += player.matroskin || 0;
        total_attacks += player.attacks || 0;
        total_successful_attacks += player.successful_attacks || 0;
      }
      
      // Формируем ответ
      const response = {
        stats: {
          total_players: total_players,
          total_cats: total_cats,
          total_matroskin: total_matroskin,
          total_attacks: total_attacks,
          total_successful_attacks: total_successful_attacks,
          success_rate: total_attacks > 0 ? Math.round((total_successful_attacks / total_attacks) * 100) : 0
        },
        timestamp: new Date().toISOString(),
        calculated_from: "cats_data.json"
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response, null, 2));
      
      console.log(`📊 Статистика отправлена: ${total_players} игроков, ${total_cats} кошек`);
      
    } catch (error) {
      console.error('❌ Ошибка:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Ошибка чтения данных' }));
    }
  } else if (req.url === '/api/cats_data' && req.method === 'GET') {
    // Прямой доступ к исходным данным
    try {
      const data = JSON.parse(fs.readFileSync('cats_data.json', 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.url === '/api/raw/stats' && req.method === 'GET') {
    // Для обратной совместимости
    try {
      const catsData = JSON.parse(fs.readFileSync('cats_data.json', 'utf8'));
      
      let total_players = 0;
      let total_cats = 0;
      let total_matroskin = 0;
      let total_attacks = 0;
      
      for (const playerId in catsData) {
        const player = catsData[playerId];
        total_players++;
        total_cats += player.cats || 0;
        total_matroskin += player.matroskin || 0;
        total_attacks += player.attacks || 0;
      }
      
      const response = {
        total_players: total_players,
        total_cats: total_cats,
        total_matroskin: total_matroskin,
        total_attacks: total_attacks
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Маршрут не найден' }));
  }
});

server.listen(8927, () => {
  console.log('✅ Сервер запущен на http://localhost:8927');
  console.log('📡 Доступные маршруты:');
  console.log('  GET /api/stats - получает статистику из cats_data.json');
  console.log('  GET /api/cats_data - прямые данные из cats_data.json');
  console.log('  GET /api/raw/stats - для обратной совместимости');
});