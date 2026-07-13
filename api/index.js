const express = require('express');
const { kv } = require('@vercel/kv');
const { nanoid } = require('nanoid');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. 메인 화면 (HTML)
app.get('/', (req, res) => {
  res.send(`
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <div style="padding: 20px; font-family: sans-serif; max-width: 400px; margin: 0 auto;">
      <h2>🔗 영구 단축 링크 생성기</h2>
      <form action="/shorten" method="POST">
        <input type="url" name="longUrl" placeholder="https://..." required style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px;">
        <input type="text" name="customSlug" placeholder="원하는 단어 (선택)" style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px;">
        <button type="submit" style="width:100%; padding:12px; background:#007bff; color:#fff; border:none; border-radius:8px; font-weight:bold;">링크 만들기</button>
      </form>
    </div>
  `);
});

// 2. 주소 생성 및 무료 KV DB에 영구 저장
app.post('/shorten', async (req, res) => {
  const { longUrl, customSlug } = req.body;
  const slug = customSlug.trim() || nanoid(4); // 없으면 랜덤 4글자
  
  try {
    // Vercel 데이터베이스에 'short:슬러그' : '원본URL' 형태로 영구 저장
    await kv.set(`short:${slug}`, longUrl);
    
    const shortUrl = `${req.protocol}://${req.get('host')}/${slug}`;
    res.send(`
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <div style="padding: 20px; font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h3>생성된 단축 주소 (# 없음):</h3>
        <input type="text" value="${shortUrl}" id="result" readonly style="width:100%; padding:12px; margin-bottom:10px; border:1px solid #ddd; border-radius:8px; font-weight:bold; color:#007bff;">
        <button onclick="navigator.clipboard.writeText(document.getElementById('result').value); alert('복사 완료!');" style="width:100%; padding:12px; background:#28a745; color:#fff; border:none; border-radius:8px; font-weight:bold;">주소 복사하기</button>
        <br><br><a href="/">돌아가기</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send('데이터베이스 저장 오류 발생');
  }
});

// 3. # 없이 주소창에 들어왔을 때 DB에서 찾아 연결
app.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const originalUrl = await kv.get(`short:${slug}`);
    if (originalUrl) {
      return res.redirect(originalUrl); // 리디렉션
    }
    return res.status(404).send('존재하지 않는 링크입니다.');
  } catch (err) {
    return res.status(500).send('서버 읽기 오류');
  }
});

module.exports = app;
