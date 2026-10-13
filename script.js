const fileInput = document.querySelector("#file-input");
const dropzone = document.querySelector("#dropzone");
const selectedFile = document.querySelector("#selected-file");
const fileName = document.querySelector("#file-name");
const fileSize = document.querySelector("#file-size");
const removeFileButton = document.querySelector("#remove-file");
const analyzeButton = document.querySelector("#analyze-button");
const previewCard = document.querySelector("#preview-card");
const resultsCard = document.querySelector("#results-card");
const resultSummary = document.querySelector("#result-summary");
const resultContent = document.querySelector("#result-content");
const toast = document.querySelector("#toast");

const allowedExtensions = new Set(["pdf", "docx", "txt"]);
let selectedSpecification = null;
let toastTimeout;

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 6000);
}

function setFile(file) {
  if (!file) return;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!allowedExtensions.has(extension)) {
    fileInput.value = "";
    showToast("Formato não suportado. Selecione um arquivo PDF, DOCX ou TXT.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    fileInput.value = "";
    showToast("O arquivo excede o limite de 10 MB.");
    return;
  }

  selectedSpecification = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatFileSize(file.size);
  selectedFile.hidden = false;
  dropzone.hidden = true;
  analyzeButton.disabled = false;
  resultsCard.hidden = true;
  previewCard.hidden = false;
  resultSummary.textContent = "";
  resultContent.replaceChildren();
}

function clearFile() {
  fileInput.value = "";
  selectedSpecification = null;
  selectedFile.hidden = true;
  dropzone.hidden = false;
  analyzeButton.disabled = true;
  resultsCard.hidden = true;
  previewCard.hidden = false;
  resultSummary.textContent = "";
  resultContent.replaceChildren();
}

function appendText(parent, tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) element.className = className;
  parent.append(element);
  return element;
}

function appendSection(parent, title) {
  const section = document.createElement("section");
  section.className = "result-section";
  appendText(section, "h3", title);
  parent.append(section);
  return section;
}

function appendEmptyState(parent, text) {
  appendText(parent, "p", text, "result-empty");
}

function appendListSection(parent, title, items) {
  const section = appendSection(parent, title);
  if (!items.length) {
    appendEmptyState(section, "Nenhum item identificado na EF.");
    return;
  }
  const list = document.createElement("ul");
  list.className = "question-list";
  for (const item of items) appendText(list, "li", item);
  section.append(list);
}

function renderAnalysis(analysis) {
  resultSummary.textContent = analysis.summary;
  resultContent.replaceChildren();

  const executionSection = appendSection(resultContent, "Passo a passo para o desenvolvedor ABAP");
  if (!analysis.execution_steps.length) {
    appendEmptyState(executionSection, "A EF não trouxe informação suficiente para sugerir etapas.");
  }
  for (const [index, step] of analysis.execution_steps.entries()) {
    const article = document.createElement("article");
    article.className = "execution-step";
    appendText(article, "span", String(index + 1).padStart(2, "0"), "step-index");
    const details = document.createElement("div");
    details.className = "step-details";
    appendText(details, "h4", step.title);
    appendText(details, "p", step.objective);
    appendText(details, "p", `Onde fazer: ${step.where}`);
    appendText(details, "p", `Como fazer: ${step.instructions}`);
    appendText(details, "p", `Orientação ABAP: ${step.abap_guidance}`);
    appendText(details, "p", `Resultado esperado: ${step.expected_result}`);
    if (step.depends_on.length) {
      appendText(details, "p", `Pré-requisitos: ${step.depends_on.join(", ")}`);
    }
    article.append(details);
    executionSection.append(article);
  }

  const referenceSection = appendSection(resultContent, "Referências SAP");
  if (!analysis.code_references.length) {
    appendEmptyState(referenceSection, "A EF não identificou transações ou objetos SAP específicos.");
  }
  for (const reference of analysis.code_references) {
    const item = document.createElement("article");
    item.className = "reference-item";
    appendText(item, "h4", `${reference.name} · ${reference.reference_type}`);
    appendText(item, "p", reference.purpose);
    appendText(item, "p", `Situação na EF: ${reference.certainty}`);
    appendText(item, "p", reference.notes);
    referenceSection.append(item);
  }

  const rulesSection = appendSection(resultContent, "Regras de negócio");
  if (!analysis.business_rules.length) {
    appendEmptyState(rulesSection, "Nenhuma regra explícita foi encontrada na EF.");
  }
  for (const rule of analysis.business_rules) {
    const item = document.createElement("article");
    item.className = "reference-item";
    appendText(item, "h4", rule.name);
    appendText(item, "p", rule.description);
    appendText(item, "p", `Aplicação no desenvolvimento: ${rule.abap_implication}`);
    appendText(item, "p", `Origem: ${rule.source}`);
    rulesSection.append(item);
  }

  const selectionSection = appendSection(resultContent, "Seleções e campos de entrada");
  if (!analysis.data_selections.length) {
    appendEmptyState(selectionSection, "A EF não especifica campos de seleção.");
  } else {
    const table = document.createElement("table");
    table.className = "selection-table";
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const label of ["Objeto / campo", "Uso", "Obrigatório", "Orientação ABAP"]) {
      appendText(headerRow, "th", label);
    }
    head.append(headerRow);
    table.append(head);

    const body = document.createElement("tbody");
    for (const selection of analysis.data_selections) {
      const row = document.createElement("tr");
      for (const value of [
        `${selection.object} / ${selection.field}`,
        selection.description,
        selection.required,
        selection.developer_guidance,
      ]) {
        appendText(row, "td", value);
      }
      body.append(row);
    }
    table.append(body);
    selectionSection.append(table);
  }

  const codeSection = appendSection(resultContent, "Exemplos de código ABAP");
  if (!analysis.abap_code_examples.length) {
    appendEmptyState(
      codeSection,
      "A EF não traz detalhes técnicos suficientes para sugerir código sem inventar objetos SAP.",
    );
  }
  for (const example of analysis.abap_code_examples) {
    const item = document.createElement("article");
    item.className = "code-example";
    appendText(item, "h4", example.title);
    appendText(item, "p", example.purpose);
    appendText(item, "span", example.code_type, "code-type");
    const pre = document.createElement("pre");
    appendText(pre, "code", example.code);
    item.append(pre);
    appendText(item, "p", `Antes de usar: ${example.validation_notes}`);
    codeSection.append(item);
  }

  const testsSection = appendSection(resultContent, "Testes para confirmar o resultado");
  if (!analysis.tests.length) {
    appendEmptyState(testsSection, "A EF não descreve cenários de teste suficientes.");
  }
  for (const test of analysis.tests) {
    const item = document.createElement("article");
    item.className = "test-case";
    appendText(item, "h4", `${test.id} · ${test.scenario}`);
    appendText(item, "p", `Tipo: ${test.type}`);
    appendText(item, "p", `Preparação: ${test.setup}`);
    appendText(item, "p", `Execução: ${test.steps}`);
    appendText(item, "p", `Resultado esperado: ${test.expected_result}`);
    testsSection.append(item);
  }

  appendListSection(resultContent, "Dúvidas para confirmar com o funcional", analysis.open_questions);
  appendListSection(resultContent, "Hipóteses que precisam de validação", analysis.assumptions);

  if (analysis.abap_glossary.length) {
    const glossarySection = appendSection(resultContent, "Glossário funcional para ABAP");
    for (const entry of analysis.abap_glossary) {
      const item = document.createElement("article");
      item.className = "reference-item";
      appendText(item, "h4", entry.term);
      appendText(item, "p", entry.meaning);
      glossarySection.append(item);
    }
  }

  resultsCard.hidden = false;
  previewCard.hidden = true;
  resultsCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function analyzeSpecification() {
  if (!selectedSpecification || analyzeButton.disabled) return;

  analyzeButton.disabled = true;
  analyzeButton.textContent = "Extraindo a EF e consultando a IA…";

  try {
    const formData = new FormData();
    formData.append("specification", selectedSpecification);
    const response = await fetch("/api/analyze", { method: "POST", body: formData });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Não foi possível analisar a especificação.");
    renderAnalysis(result);
  } catch (error) {
    const message = error instanceof TypeError
      ? "Não foi possível conectar ao servidor. Execute Iniciar site.bat e acesse http://127.0.0.1:3000 (não abra o index.html diretamente)."
      : error.message || "Não foi possível comunicar com o servidor local.";
    showToast(message);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.innerHTML = `Analisar EF com IA
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h12m0 0-5-5m5 5-5 5" />
      </svg>`;
  }
}

dropzone.addEventListener("click", (event) => {
  if (event.target === fileInput || event.target.closest("label")) return;
  fileInput.click();
});
fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
removeFileButton.addEventListener("click", clearFile);
analyzeButton.addEventListener("click", analyzeSpecification);

for (const eventName of ["dragenter", "dragover"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  });
}

dropzone.addEventListener("drop", (event) => setFile(event.dataTransfer.files[0]));
