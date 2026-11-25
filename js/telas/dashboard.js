// Dashboard: indicadores do período e atendimentos compartilhados com o WhatsApp.
import { STATUS, filtrarAtendimentos } from "../atendimentos.js";
import { listarAtendimentos, inscrever } from "../estado.js";
import { $, escapar, iniciais, corAvatar, badgeStatus, formatarPreco, ROTULO_STATUS } from "../ui.js";

const ORIGENS = [
  { rotulo: "Instagram (posts)", cor: "#8b5cf6" },
  { rotulo: "Instagram (direct)", cor: "#6366f1" },
  { rotulo: "Outros", cor: "#22d3ee" },
  { rotulo: "Link direto", cor: "#a78bfa" }
];

// Calcula a porcentagem e evita dividir por zero.
function calcularPercentual(parte, total) {
  if (total === 0) return 0;
  return (parte / total) * 100;
}

// Carrega a tela e escuta mudanças no filtro e na lista do WhatsApp.
export function iniciarDashboard() {
  const seletor = $("#filtroPeriodo");
  seletor.addEventListener("change", function () {
    renderizarPeriodo(seletor.selectedOptions[0].textContent);
  });
  renderizarPeriodo(seletor.selectedOptions[0].textContent);

  renderizarAtendimentos(listarAtendimentos());
  inscrever(renderizarAtendimentos);
}

// Mostra zero enquanto não há dados para os indicadores do período.
function renderizarPeriodo(periodo) {
  const indicadores = ["kpiFinalizados", "kpiTratamento", "kpiNaoConcluidos", "kpiIntervencao"];

  $("#kpiClientes").textContent = "0";
  $("#kpiClientesTend").textContent = "0%";

  for (const id of indicadores) {
    $(`#${id}`).textContent = "0";
    $(`#${id}Pct`).textContent = "0%";
  }

  $("#metricaResolucao").textContent = "0%";
  $("#barraResolucao").style.setProperty("--valor", "0%");

  renderizarOrigem();
  renderizarVendas(periodo);
}

// Mantém a rosca neutra e mostra zero para cada origem.
function renderizarOrigem() {
  const rosca = $("#graficoOrigem");
  let legenda = "";

  rosca.style.background = "var(--border)";
  $("#donutTotal").textContent = "0";

  for (const item of ORIGENS) {
    legenda += `
    <li>
      <span class="donut-legend__dot" style="background:${item.cor}"></span>
      <span>${item.rotulo}</span>
      <strong>0%</strong>
    </li>`;
  }
  $("#legendaOrigem").innerHTML = legenda;
}

// Preserva o espaço do gráfico e informa que o período está vazio.
function renderizarVendas(periodo) {
  $("#valorVendas").textContent = formatarPreco(0);
  $("#tendenciaVendas").textContent = "0%";

  const grafico = $("#graficoVendas");
  grafico.innerHTML = `
    <line class="line-chart__grid" x1="0" x2="300" y1="30" y2="30"/>
    <line class="line-chart__grid" x1="0" x2="300" y1="60" y2="60"/>
    <line class="line-chart__grid" x1="0" x2="300" y1="90" y2="90"/>
    <text x="150" y="52" text-anchor="middle" fill="var(--text-muted)">Sem dados de vendas</text>
    <text x="150" y="77" text-anchor="middle" fill="var(--text-muted)"></text>`;
  $("text:last-child", grafico).textContent = periodo;
  grafico.setAttribute("aria-label", `Sem dados de vendas para o período: ${periodo}`);
}

// Recalcula o resumo e a lista de conversas quando o WhatsApp atualiza os dados.
function renderizarAtendimentos(atendimentos) {
  const ordem = [STATUS.EM_ATENDIMENTO, STATUS.AGUARDANDO_HUMANO, STATUS.ASSUMIDO, STATUS.RESOLVIDO];
  let resumo = "";
  let recentes = "";

  // Conta os atendimentos de cada status para preencher a barra.
  for (const status of ordem) {
    const quantidade = filtrarAtendimentos(atendimentos, status).length;
    const percentual = calcularPercentual(quantidade, atendimentos.length);
    resumo += `
        <li>
          <span>${ROTULO_STATUS[status]}</span>
          <strong>${quantidade}</strong>
          <div class="progress progress--${status}"><span style="--valor:${percentual}%"></span></div>
        </li>`;
  }

  // Cada conversa recente tem um link direto para a tela do WhatsApp.
  for (const atendimento of atendimentos.slice(0, 4)) {
    const ultima = atendimento.mensagens[atendimento.mensagens.length - 1];
    recentes += `
        <li>
          <a href="#whatsapp/${atendimento.id}">
            <span class="avatar avatar--sm" data-cor="${corAvatar(atendimento.cliente)}">${iniciais(atendimento.cliente)}</span>
            <div>
              <strong>${escapar(atendimento.cliente)}</strong>
              <p>${escapar(ultima?.texto ?? "Novo atendimento")}</p>
            </div>
            ${badgeStatus(atendimento.status)}
          </a>
        </li>`;
  }
  $("#resumoStatus").innerHTML = resumo;
  if (!recentes) recentes = '<li class="empty-state">Nenhum atendimento ainda.</li>';
  $("#listaRecentes").innerHTML = recentes;
}
