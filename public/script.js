async function fetchJson() {
  try {
    const response = await fetch('../data/cloud_data.json');
    const jsonData = await response.json();
    document.getElementById('jsonDisplay').textContent = JSON.stringify(jsonData, null, 4);
  } catch (error) {
    console.error('JSONの取得に失敗:', error);
    document.getElementById('jsonDisplay').textContent = 'データ取得エラー';
  }
}

setInterval(fetchJson, 500);
fetchJson();