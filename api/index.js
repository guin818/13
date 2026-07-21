const express = require('express');
const { kv } = require('@vercel/kv');
const { nanoid } = require('nanoid');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 공통 스타일 및 로고 컴포넌트
const logoHeader = `<div style="position: absolute; top: 16px; left: 16px; font-size: 14px; font-weight: bold; color: #64748b; font-family: sans-serif;">ghu.ggm.kr</div>`;

// 1. 메인 화면
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>단축 링크</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f9; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; box-sizing: border-box; position: relative; }
        .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 100%; max-width: 400px; box-sizing: border-box; margin-top: 40px; }
        h2 { margin-top: 0; color: #1e293b; text-align: center; font-size: 22px; font-weight: 700; margin-bottom: 20px; }
        label { font-size: 14px; color: #64748b; font-weight: 600; display: block; margin-bottom: 6px; }
        input { width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; transition: border 0.2s; -webkit-appearance: none; }
        input:focus { border-color: #3b82f6; outline: none; }
        button { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; -webkit-tap-highlight-color: transparent; }
        button:active { background: #1d4ed8; }
      </style>
    </head>
    <body>
      ${logoHeader}
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

// 2. 주소 생성 화면 (모바일 하이브리드 복사 로직 적용)
app.post('/shorten', async (req, res) => {
  const { longUrl, customSlug } = req.body;
  const slug = customSlug.trim() || nanoid(4);
  
  try {
    await kv.set(`short:${slug}`, longUrl);
    const shortUrl = `${req.protocol}://${req.get('host')}/${slug}`;
    
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>완성</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f4f6f9; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; box-sizing: border-box; position: relative; }
          .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 100%; max-width: 400px; box-sizing: border-box; text-align: center; margin-top: 40px; }
          h3 { margin-top: 0; color: #1e293b; font-size: 20px; margin-bottom: 16px; }
          input { width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; text-align: center; font-weight: 700; color: #2563eb; background: #f8fafc; }
          .btn-copy { width: 100%; padding: 14px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; -webkit-tap-highlight-color: transparent; }
          .btn-copy:active { background: #047857; }
          .back-link { display: inline-block; color: #64748b; font-size: 14px; text-decoration: none; margin-top: 8px; }
        </style>
      </head>
      <body>
        ${logoHeader}
        <div class="card">
          <h3>🎉 생성 완료</h3>
          <input type="text" value="${shortUrl}" id="shortUrl" readonly onclick="this.select();">
          <button class="btn-copy" id="copyBtn" onclick="copyUrl()">링크 복사하기</button>
          <a href="/" class="back-link">새로 만들기</a>
        </div>

        <script>
          function copyUrl() {
            const input = document.getElementById("shortUrl");
            const btn = document.getElementById("copyBtn");
            const textToCopy = input.value;

            // 스마트폰 최적화 텍스트 강제 선택
            input.select();
            input.setSelectionRange(0, 99999);

            // [방법 1] 최신 Clipboard API 시도
            if (navigator.clipboard && window.isSecureContext) {
              navigator.clipboard.writeText(textToCopy).then(() => {
                showSuccess(btn);
              }).catch(() => {
                fallbackCopy(input, btn);
              });
            } else {
              // [방법 2] 비보안/인앱 브라우저용 구형 execCommand 시도
              fallbackCopy(input, btn);
            }
          }

          function fallbackCopy(input, btn) {
            try {
              const successful = document.execCommand('copy');
              if (successful) {
                showSuccess(btn);
              } else {
                throw new Error('ExecCommand failed');
              }
            } catch (err) {
              // [방법 3] 모든 방법이 차단된 특수 인앱 브라우저 대피책
              alert("보안 브라우저 정책으로 자동 복사가 차단되었습니다.\\n입력창의 주소를 꾹 눌러 복사해 주세요!");
            }
          }

          function showSuccess(btn) {
            const originalText = btn.innerText;
            btn.innerText = "✓ 복사 완료!";
            btn.style.background = "#059669";
            
            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.background = "#10b981";
            }, 2000);
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
