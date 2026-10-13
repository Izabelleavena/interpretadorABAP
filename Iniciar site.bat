@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 ou superior precisa estar instalado para iniciar o site.
  echo Acesse https://nodejs.org/ e instale a versao LTS.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($listener) { exit 1 }"
if errorlevel 1 (
  echo A porta 3000 ja esta em uso.
  echo Feche a janela preta do servidor Assistente SAP ABAP e execute este arquivo novamente.
  echo Isso e necessario para carregar as chaves salvas no arquivo .env.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Preparando o site pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel instalar as dependencias do site.
    pause
    exit /b 1
  )
)

if not exist "node_modules\dotenv\package.json" (
  echo Atualizando as dependencias do site...
  call npm install
  if errorlevel 1 (
    echo Nao foi possivel atualizar as dependencias do site.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo O arquivo .env foi criado para guardar sua chave Gemini.
  echo Cole sua chave depois de GEMINI_API_KEY= e salve o arquivo.
  echo Feche o Bloco de Notas apos salvar para iniciar o site.
  start "" notepad.exe ".env"
  pause
)

start "Assistente SAP ABAP" cmd /k "cd /d ""%~dp0"" && npm start"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; for ($i = 0; $i -lt 30; $i++) { try { Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 1 } }; if ($ready) { Start-Process 'http://127.0.0.1:3000' } else { exit 1 }"
if errorlevel 1 (
  echo O site nao iniciou. Confira a janela do servidor para ver o erro.
  pause
)
