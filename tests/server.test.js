import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../server.js";

const sampleAnalysis = {
  summary: "Criar um relatório ABAP para exibir pedidos conforme os filtros da EF.",
  execution_steps: [
    {
      title: "Confirmar os campos de seleção",
      objective: "Definir os filtros com o funcional antes de implementar o relatório.",
      where: "Não informado na EF; confirmar com o funcional",
      instructions: "Revise os filtros descritos na EF e registre os campos obrigatórios e opcionais.",
      abap_guidance: "Implemente os filtros na selection-screen depois de confirmar nomes e tipos.",
      expected_result: "Filtros acordados e documentados.",
      depends_on: [],
    },
  ],
  code_references: [],
  business_rules: [],
  data_selections: [],
  abap_code_examples: [],
  tests: [],
  open_questions: [],
  assumptions: [],
  abap_glossary: [],
};

function createPdf(text) {
  const content = `BT /F1 12 Tf 24 120 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    document += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

function createDocx() {
  return Buffer.from(
    "UEsDBBQAAAAIAO5VTV2F+4joyAAAACcBAAARAAAAd29yZC9kb2N1bWVudC54bWxtj9FKBDEMRX+lVNg3p+MqIrMzsw/CfoF+QJzG3ULblCTjuH9vK4ggvpwQLveQjMfPFM0HsgTKk73remswL+RDPk/29eV0+2SNKGQPkTJO9opij/O4DZ6WNWFWUwVZhm2yF9UyOCfLBRNIRwVzzd6JE2hd+ew2Yl+YFhSp/hTdvu8fXYKQbVO+kb+2WRq4QednDsBmTYYxgu5u9g/3Bw40uhY28jfL394pROXaLOiDJzGF2HhQMDtI5dBe0lW6fzTu5w73++P8BVBLAQIUABQAAAAIAO5VTV2F+4joyAAAACcBAAARAAAAAAAAAAAAAACAAQAAAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAQABAD8AAAD3AAAAAAA=",
    "base64",
  );
}

function successfulGeminiResponse(analysis = sampleAnalysis) {
  return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }],
  });
}

async function startServer(t, options) {
  const server = createApp(options).listen(0);
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

async function analyzeFile(baseUrl, file, filename) {
  const form = new FormData();
  form.append("specification", new Blob([file]), filename);
  return fetch(`${baseUrl}/api/analyze`, { method: "POST", body: form });
}

test("serves the site with an automatic Gemini analysis action", async (t) => {
  const baseUrl = await startServer(t);
  const [page, health, script] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/script.js`),
  ]);

  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Analisar EF com IA/);
  assert.match(html, /O texto da EF será enviado ao Gemini.*Groq/);
  assert.match(html, /<label class="browse-button" for="file-input">Procurar arquivo<\/label>/);
  assert.match(html, /id="file-input"[\s\S]*?type="file"/);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /^text\/javascript\b/);
  assert.match(await script.text(), /fileInput\.addEventListener\("change"/);
  assert.deepEqual(await health.json(), { status: "ok" });
});

test("extracts TXT and returns a structured Gemini analysis", async (t) => {
  let geminiRequest;
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    getGroqApiKey: () => "",
    requestGemini: async (url, options) => {
      geminiRequest = { url, options, body: JSON.parse(options.body) };
      return successfulGeminiResponse();
    },
  });
  const response = await analyzeFile(
    baseUrl,
    "Criar relatório de pedidos com filtro por data.",
    "especificacao.txt",
  );
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.summary, sampleAnalysis.summary);
  assert.equal(result.execution_steps[0].title, sampleAnalysis.execution_steps[0].title);
  assert.match(geminiRequest.url, /gemini-3\.5-flash:generateContent/);
  assert.equal(geminiRequest.options.headers["x-goog-api-key"], "test-api-key");
  assert.equal(geminiRequest.body.generationConfig.responseMimeType, "application/json");
  assert.match(geminiRequest.body.contents[0].parts[0].text, /filtro por data/);
  assert.match(geminiRequest.body.systemInstruction.parts[0].text, /já foi extraído do arquivo/);
  assert.match(geminiRequest.body.contents[0].parts[0].text, /não é necessário acessar nenhum anexo/);
});

test("extracts DOCX text before sending it to Gemini", async (t) => {
  let prompt = "";
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    requestGemini: async (_url, options) => {
      prompt = JSON.parse(options.body).contents[0].parts[0].text;
      return successfulGeminiResponse();
    },
  });
  const response = await analyzeFile(baseUrl, createDocx(), "especificacao.docx");

  assert.equal(response.status, 200);
  assert.match(prompt, /Criar um relatório/);
  assert.match(prompt, /pedidos por data & status/);
});

test("extracts selectable PDF text before sending it to Gemini", async (t) => {
  let prompt = "";
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    requestGemini: async (_url, options) => {
      prompt = JSON.parse(options.body).contents[0].parts[0].text;
      return successfulGeminiResponse();
    },
  });
  const response = await analyzeFile(
    baseUrl,
    createPdf("Create SAP report by date"),
    "especificacao.pdf",
  );

  assert.equal(response.status, 200);
  assert.match(prompt, /Create SAP report by date/);
});

test("shows setup instructions when the Gemini key is missing", async (t) => {
  const baseUrl = await startServer(t, {
    getApiKey: () => "",
    getGroqApiKey: () => "",
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /README\.md/);
});

test("uses Groq when Gemini is unavailable", async (t) => {
  let groqRequest;
  const baseUrl = await startServer(t, {
    getApiKey: () => "gemini-test-key",
    getGroqApiKey: () => "groq-test-key",
    requestGemini: async () => new Response("{}", { status: 503 }),
    requestGroq: async (url, options) => {
      groqRequest = { url, options, body: JSON.parse(options.body) };
      return Response.json({
        choices: [{ message: { content: JSON.stringify(sampleAnalysis) } }],
      });
    },
  });
  const response = await analyzeFile(
    baseUrl,
    "Criar relatório de pedidos com filtro por data.",
    "especificacao.txt",
  );
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.summary, sampleAnalysis.summary);
  assert.equal(groqRequest.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(groqRequest.options.headers.Authorization, "Bearer groq-test-key");
  assert.equal(groqRequest.body.model, "openai/gpt-oss-20b");
  assert.equal(groqRequest.body.response_format.type, "json_schema");
  assert.equal(groqRequest.body.response_format.json_schema.strict, false);
  assert.equal(groqRequest.body.response_format.json_schema.schema.additionalProperties, false);
  assert.match(groqRequest.body.messages[1].content, /filtro por data/);
});

test("fills omitted optional Groq sections while preserving required analysis content", async (t) => {
  const partialAnalysis = {
    summary: "Criar relatório de pedidos por data.",
    execution_steps: [{ title: "Definir seleção", instructions: "Confirmar os filtros na EF." }],
  };
  const baseUrl = await startServer(t, {
    getApiKey: () => "",
    getGroqApiKey: () => "groq-test-key",
    requestGroq: async () => Response.json({
      choices: [{ message: { content: JSON.stringify(partialAnalysis) } }],
    }),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.summary, partialAnalysis.summary);
  assert.equal(result.execution_steps[0].title, "Definir seleção");
  assert.equal(result.execution_steps[0].objective, "");
  assert.deepEqual(result.assumptions, []);
  assert.deepEqual(result.abap_glossary, []);
  assert.deepEqual(result.business_rules, []);
});

test("retries Groq with progressively larger output limits when its structured response is truncated", async (t) => {
  const requestedLimits = [];
  const baseUrl = await startServer(t, {
    getApiKey: () => "",
    getGroqApiKey: () => "groq-test-key",
    requestGroq: async (_url, options) => {
      requestedLimits.push(JSON.parse(options.body).max_tokens);
      if (requestedLimits.length < 3) {
        return Response.json({
          error: {
            code: "json_validate_failed",
            message: "max_completion_tokens reached before generating a valid document",
          },
        }, { status: 400 });
      }
      return Response.json({
        choices: [{ message: { content: JSON.stringify(sampleAnalysis) } }],
      });
    },
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.summary, sampleAnalysis.summary);
  assert.deepEqual(requestedLimits, [16_384, 32_768, 65_536]);
});

test("returns a clear error after Groq rejects structured JSON three times", async (t) => {
  let attempts = 0;
  const baseUrl = await startServer(t, {
    getApiKey: () => "",
    getGroqApiKey: () => "groq-test-key",
    requestGroq: async () => {
      attempts += 1;
      return Response.json({
        error: { code: "json_validate_failed", message: "Generated JSON did not match the schema" },
      }, { status: 400 });
    },
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");
  const result = await response.json();

  assert.equal(response.status, 502);
  assert.equal(attempts, 3);
  assert.match(result.error, /JSON válido após três tentativas automáticas/);
});

test("uses Groq directly when Gemini is not configured", async (t) => {
  let geminiRequested = false;
  const baseUrl = await startServer(t, {
    getApiKey: () => "",
    getGroqApiKey: () => "groq-test-key",
    requestGemini: async () => {
      geminiRequested = true;
      throw new Error("Gemini must not be called without an API key");
    },
    requestGroq: async () => Response.json({
      choices: [{ message: { content: JSON.stringify(sampleAnalysis) } }],
    }),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 200);
  assert.equal(geminiRequested, false);
});

test("rejects analysis requests from a different website", async (t) => {
  const baseUrl = await startServer(t, { getApiKey: () => "test-api-key" });
  const form = new FormData();
  form.append("specification", new Blob(["Especificação."]), "especificacao.txt");
  const response = await fetch(`${baseUrl}/api/analyze`, {
    method: "POST",
    headers: { Origin: "https://example.com" },
    body: form,
  });

  assert.equal(response.status, 403);
});

test("shows a clear message when the free Gemini quota is reached", async (t) => {
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    getGroqApiKey: () => "",
    requestGemini: async () => new Response("{}", { status: 429 }),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /cota gratuita/);
});

test("explains when Gemini is temporarily unavailable", async (t) => {
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    getGroqApiKey: () => "",
    requestGemini: async () => Response.json(
      { error: { code: 503, message: "Temporary high demand", status: "UNAVAILABLE" } },
      { status: 503 },
    ),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /temporariamente indisponível/i);
});

test("explains when the configured Gemini model is unavailable", async (t) => {
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    getGroqApiKey: () => "",
    requestGemini: async () => Response.json(
      { error: { code: 404, message: "Model unavailable", status: "NOT_FOUND" } },
      { status: 404 },
    ),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /GEMINI_MODEL/);
});

test("explains when Gemini blocks the extracted specification text", async (t) => {
  const baseUrl = await startServer(t, {
    getApiKey: () => "test-api-key",
    getGroqApiKey: () => "",
    requestGemini: async () => Response.json({
      promptFeedback: { blockReason: "SAFETY" },
    }),
  });
  const response = await analyzeFile(baseUrl, "Especificação.", "especificacao.txt");

  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /texto da EF foi enviado.*bloqueou a análise/i);
});

test("rejects unsupported files, missing files, and PDFs without selectable text", async (t) => {
  const baseUrl = await startServer(t, { getApiKey: () => "test-api-key" });
  const unsupported = await analyzeFile(baseUrl, "conteúdo", "arquivo.exe");
  const missing = await fetch(`${baseUrl}/api/analyze`, { method: "POST" });
  const scannedPdf = await analyzeFile(baseUrl, Buffer.from("%PDF-1.4\n%%EOF"), "digitalizado.pdf");

  assert.equal(unsupported.status, 415);
  assert.match((await unsupported.json()).error, /PDF, DOCX ou TXT/);
  assert.equal(missing.status, 400);
  assert.match((await missing.json()).error, /Anexe uma especificação/);
  assert.equal(scannedPdf.status, 400);
  assert.match((await scannedPdf.json()).error, /PDF/);
});
