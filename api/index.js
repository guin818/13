const express = require('express');
const { kv } = require('@vercel/kv');
const { nanoid } = require('nanoid');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 공통 스타일 및 로고 컴포넌트
const logoHeader = `<div style="position: absolute; top: 16px; left: 16px; font-size: 14px; font-weight: bold; color: #64748b; font-family: sans-serif;">ghu.ggm.kr</div>`;

// 공통 HTML 템플릿 함수 (디자인 통일)
function createHtmlPage(title, content) {
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f6f9; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; box-sizing: border-box; position: relative; }
        .card { background: white; padding: 24px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 100%; max-width: 400px; box-sizing: border-box; text-align: center; margin-top: 40px; }
        h2, h3 { margin-top: 0; color: #1e293b; font-size: 22px; font-weight: 700; margin-bottom: 20px; text-align: center; }
        label { font-size: 14px; color: #64748b; font-weight: 600; display: block; margin-bottom: 6px; text-align: left; }
        input { width: 100%; padding: 14px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 10px; box-sizing: border-box; font-size: 16px; transition: border 0.2s; -webkit-appearance: none; }
        input:focus { border-color: #3b82f6; outline: none; }
        .btn-blue { width: 100%; padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background 0.2s; -webkit-tap-highlight-color: transparent; }
        .btn-blue:active { background: #1d4ed8; }
        .btn-copy { width: 100%; padding: 14px; background: #10b981; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-bottom: 12px; -webkit-tap-highlight-color: transparent; }
        .btn-copy:active { background: #047857; }
        .back-link { display: inline-block; color: #64748b; font-size: 14px; text-decoration: none; margin-top: 12px; font-weight: 600; }
        .error-msg { color: #ef4444; font-size: 16px; font-weight: 700; margin-bottom: 16px; line-height: 1.5; }
        .input-result { text-align: center; font-weight: 700; color: #2563eb; background: #f8fafc; }
      </style>
    </head>
    <body>
      ${logoHeader}
      <div class="card">
        ${content}
      </div>
    </body>
    </html>
  `;
}

// 1. 메인 화면
app.get('/', (req, res) => {
  res.send(createHtmlPage('단축 링크', `
    <h2>🔗 단축 링크 생성기</h2>
    <form action="/shorten" method="POST">
      <label>줄일 긴 주소 입력</label>
      <input type="url" name="longUrl" placeholder="https://example.com" required inputmode="url">
      
      <label>원하는 단축 단어 (선택)</label>
      <input type="text" name="customSlug" placeholder="예: apple" autocomplete="off">
      
      <button type="submit" class="btn-blue">링크 줄이기</button>
    </form>
  `));
});

// 2. 주소 생성 및 중복 체크 로직
app.post('/shorten', async (req, res) => {
  const { longUrl, customSlug } = req.body;
  const isCustom = customSlug && customSlug.trim().length > 0;
  let slug = isCustom ? customSlug.trim() : nanoid(4);
  
  try {
    // 중복 검사: 사용자가 단어(Slug)를 직접 입력했을 때만 실행
    if (isCustom) {
      const exists = await kv.get(`short:${slug}`);
      if (exists) {
        return res.send(createHtmlPage('생성 실패', `
          <h3 style="color: #ef4444;">⚠️ 생성 실패</h3>
          <p class="error-msg">"${slug}"은(는)<br>이미 사용 중인 단어입니다.</p>
          <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">다른 단어를 입력해 주세요.</p>
          <a href="javascript:history.back()" class="btn-blue" style="display:block; text-decoration:none; box-sizing:border-box;">뒤로 가기</a>
        `));
      }
    } else {
      // 자동 생성인 경우 아주 희박한 확률의 중복 방지를 위해 재확인 후 새 단어 부여
      let exists = await kv.get(`short:${slug}`);
      while (exists) {
        slug = nanoid(4);
        exists = await kv.get(`short:${slug}`);
      }
    }
    
    // 데이터베이스 저장 및 결과 화면 출력
    await kv.set(`short:${slug}`, longUrl);
    const shortUrl = `${req.protocol}://${req.get('host')}/${slug}`;
    
    res.send(createHtmlPage('완성', `
      <h3>🎉 생성 완료</h3>
      <input type="text" value="${shortUrl}" id="shortUrl" class="input-result" readonly onclick="this.select();">
      <button class="btn-copy" id="copyBtn" onclick="copyUrl()">링크 복사하기</button>
      <a href="/" class="back-link">새로 만들기</a>

      <script>
        function copyUrl() {
          const input = document.getElementById("shortUrl");
          const btn = document.getElementById("copyBtn");
          const textToCopy = input.value;

          input.select();
          input.setSelectionRange(0, 99999);

          if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(textToCopy).then(() => {
              showSuccess(btn);
            }).catch(() => {
              fallbackCopy(input, btn);
            });
          } else {
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
    `));
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
