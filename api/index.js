const express = require('express');
const { kv } = require('@vercel/kv');
const { nanoid } = require('nanoid');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 1. 메인 화면 (모바일 100% 맞춤형 UI 디자인)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>단축 링크</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f9; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; box-sizing: border-box; }
        .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 100%; max-width: 400px; box-sizing: border-box; }
        h2 { margin-top: 0; color: #1e293b; text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 20px; }
        label { font-size: 14px; color: #64748b; font-weight: 600; display: block; margin-bottom: 6px; }
        input { width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; transition: border 0.2s; -webkit-appearance: none; }
        input:focus { border-color: #3b82f6; outline: none; }
        button { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; -webkit-tap-highlight-color: transparent; }
        button:active { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🔗 단축 링크 생성기</h2>
        <form action="/shorten" method="POST">
          <label>줄일 긴 주소 입력</label>
          <input type="url" name="longUrl" placeholder="https://example.com" required inputmode="url">
          
          <label>원하는 단축 단어 (선택)</label>
          <input type="text" name="customSlug" placeholder="예: apple" autocomplete="off">
          
          <button type="submit">링크 줄이기</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// 2. 주소 생성 화면 (모바일 전용 강제 복사 시스템 적용)
app.post('/shorten', async (req, res) => {
  const { longUrl, customSlug } = req.body;
  const slug = customSlug.trim() || nanoid(4);
  
  try {
    await kv.set(`short:${slug}`, longUrl);
    
    // 도메인 주소 포맷팅
    const shortUrl = `${req.protocol}://${req.get('host')}/${slug}`;
    
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>완성</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f4f6f9; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; box-sizing: border-box; }
          .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 100%; max-width: 400px; box-sizing: border-box; text-align: center; }
          h3 { margin-top: 0; color: #1e293b; font-size: 20px; margin-bottom: 16px; }
          input { width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; text-align: center; font-weight: 700; color: #2563eb; background: #f8fafc; }
          .btn-copy { width: 100%; padding: 14px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; }
          .btn-copy:active { background: #047857; }
          .back-link { display: inline-block; color: #64748b; font-size: 14px; text-decoration: none; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h3>🎉 생성 완료</h3>
          <input type="text" value="${shortUrl}" id="shortUrl" readonly>
          <button class="btn-copy" onclick="copyToClipboard()">링크 복사하기</button>
          <a href="/" class="back-link">새로 만들기</a>
        </div>

        <script>
          // 모바일 인앱 브라우저(카톡, 페북 등)에서도 100% 성공하는 안전 복사 함수
          function copyToClipboard() {
            const copyText = document.getElementById("shortUrl");
            
            // 기존 텍스트 선택 처리
            copyText.select();
            copyText.setSelectionRange(0, 99999); // 모바일 웹킷 대응
            
            // 1차 클립보드 API 시도
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(copyText.value)
                .then(() => alert("단축 링크가 복사되었습니다!"))
                .catch(() => oldSchoolCopy(copyText));
            } else {
              oldSchoolCopy(copyText);
            }
          }

          // 구형 브라우저 및 일부 모바일 웹뷰 대응용 2차 복사 보완 로직
          function oldSchoolCopy(element) {
            try {
              document.execCommand("copy");
              alert("단축 링크가 복사되었습니다!");
            } catch (err) {
              alert("복사에 실패했습니다. 주소창을 길게 눌러 직접 복사해 주세요.");
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('데이터베이스 오류');
  }
});

// 3. 리디렉션 처리
app.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const originalUrl = await kv.get(`short:${slug}`);
    if (originalUrl) return res.redirect(originalUrl);
    return res.status(404).send('존재하지 않는 링크입니다.');
  } catch (err) {
    return res.status(500).send('서버 오류');
  }
});

module.exports = app;
