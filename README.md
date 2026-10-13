# Assistente SAP ABAP

Programa para interpretar especificações funcionais (EF) e gerar um guia do que o desenvolvedor ABAP deve fazer.

O site extrai o texto de uma especificação funcional em PDF com texto selecionável, DOCX ou TXT e envia o conteúdo à API do Google Gemini. Se o Gemini estiver indisponível, sem cota ou com o modelo fora do ar, tenta automaticamente a API Groq quando uma chave Groq estiver configurada. A resposta é exibida na tela, estruturada em resumo, roteiro ABAP, referências SAP, regras, seleções, exemplos de código, testes, dúvidas e glossário.

## Configurar a chave do Gemini (uma vez)

Requer Node.js 20 ou superior.

1. Acesse [Google AI Studio — criar chave Gemini](https://aistudio.google.com/apikey) e entre na sua conta Google.
2. Crie uma chave de API e copie-a. Para continuar na faixa gratuita, não vincule faturamento ao projeto.
3. Na primeira inicialização, **Iniciar site.bat** cria o arquivo `.env` e o abre no Bloco de Notas. Se precisar criá-lo manualmente, use:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Cole a chave copiada depois de `GEMINI_API_KEY=` e mantenha o modelo:

   ```text
   GEMINI_API_KEY=sua_chave_aqui
   GEMINI_MODEL=gemini-3.5-flash
   ```

5. Salve o arquivo e feche o Bloco de Notas. Na janela preta que apareceu, pressione uma tecla. O site instalará as dependências, iniciará o servidor e abrirá o navegador.
6. Nas próximas vezes, basta dar dois cliques em **Iniciar site.bat**. Se o servidor já estava aberto quando você mudou a chave, feche a janela dele e inicie novamente.

Nunca compartilhe a chave nem publique o arquivo `.env`.

## Configurar a contingência Groq (recomendado)

1. Acesse [Groq Console — criar chave](https://console.groq.com/keys), entre ou crie sua conta e gere uma API key.
2. Abra o arquivo `.env` na pasta do site e cole a chave depois de `GROQ_API_KEY=`. Mantenha o modelo `openai/gpt-oss-20b`:

   ```text
   GROQ_API_KEY=sua_chave_groq_aqui
   GROQ_MODEL=openai/gpt-oss-20b
   ```

3. Salve o arquivo, feche a janela do servidor e execute **Iniciar site.bat** novamente.

O Gemini continua sendo tentado primeiro. O Groq é usado automaticamente se o Gemini atingir a cota (HTTP 429), ficar indisponível (erros de servidor ou conexão) ou se o modelo configurado deixar de existir. Se o Gemini não estiver configurado, o Groq pode ser usado sozinho. As duas chaves ficam apenas no servidor local e nunca são enviadas ao navegador.

O Groq tem limites de uso e disponibilidade próprios, inclusive na faixa gratuita; a contingência não garante disponibilidade contínua. Consulte os [modelos ativos](https://console.groq.com/docs/models) e [limites atuais](https://console.groq.com/docs/rate-limits).

Depois disso, selecione uma EF e clique em **Analisar EF com IA**. O site processa o arquivo, tenta o Gemini e, quando necessário, usa o Groq como contingência. Use o endereço `http://127.0.0.1:3000`; abrir `index.html` diretamente não inicia o servidor necessário para a análise.

## Cota gratuita e privacidade

Os modelos `gemini-3.5-flash` e `openai/gpt-oss-20b` podem estar disponíveis nos planos gratuitos de seus provedores, sujeitos aos limites e à disponibilidade definidos por cada serviço. O site não ativa faturamento nem tenta trocar para um serviço pago. Consulte os [limites e preços do Gemini](https://ai.google.dev/gemini-api/docs/pricing) e os [limites atuais do Groq](https://console.groq.com/docs/rate-limits).

O arquivo é recebido pelo servidor local em memória e não é salvo em disco. O texto extraído é enviado ao Google para análise e, se o Gemini falhar, pode ser enviado à Groq. Cada provedor trata os dados conforme seus próprios termos e políticas; não envie especificações confidenciais sem autorização da sua organização.

PDFs digitalizados sem camada de texto precisam passar por OCR antes do envio. Limites do site: 10 MB por arquivo e 100 mil caracteres extraídos.

## Testes

```powershell
npm install
npm test
```
