/* ==========================================================================
   Tela 1 — Dashboard
   Mostra números VERDADEIROS a partir dos atendimentos carregados do
   Supabase (os mesmos da tela de WhatsApp). Quando um status muda no
   WhatsApp, o Dashboard é avisado e recalcula tudo na hora.

   O que a lista de atendimentos traz hoje: id, status, nome e telefone do
   cliente. Ela NÃO traz data, identificador do cliente, origem, quem
   resolveu o atendimento nem vendas. Por isso esses cartões mostram um
   aviso em vez de números inventados.
   ========================================================================== */

import { STATUS } from "../atendimentos.js";
import { calcularMetricas } from "../dashboard.js";
import { listarAtendimentos, inscrever } from "../estado.js";
import { $, escapar, iniciais, corAvatar, badgeStatus, ROTULO_STATUS } from "../ui.js";

// Calcula a porcentagem (0 a 100) e evita dividir por zero.
function calcularPercentual(parte, total) {
  if (total === 0) return 0;
  return Math.round((parte / total) * 100);
}

// Liga o filtro de período e passa a ouvir as mudanças dos atendimentos.
export function iniciarDashboard() {
  const seletor = $("#filtroPeriodo");
  seletor.addEventListener("change", function () {
    mostrarAvisoPeriodo(seletor.selectedOptions[0].textContent);
  });
  mostrarAvisoPeriodo(seletor.selectedOptions[0].textContent);

  mostrarOrigemSemDados();
  mostrarVendasSemDados();

  renderizarAtendimentos(listarAtendimentos());
  inscrever(renderizarAtendimentos); // recalcula sempre que o WhatsApp mudar algo
}

/* ---------- Filtro de período ---------- */

// Os atendimentos ainda não têm data, então o filtro não pode ser aplicado.
// Em vez de mostrar números errados, a tela avisa que conta todos.
function mostrarAvisoPeriodo(periodo) {
  $("#avisoPeriodo").textContent =
    `Período escolhido: ${periodo}. Os atendimentos ainda não têm data salva no sistema, ` +
    "então os números abaixo consideram todos os atendimentos.";
}

/* ---------- Tudo que depende dos atendimentos ---------- */

// Chamada no início e toda vez que a lista de atendimentos muda.
function renderizarAtendimentos(atendimentos) {
  const metricas = calcularMetricas(atendimentos);
  renderizarIndicadores(metricas);
  renderizarDesempenho(metricas);
  renderizarResumoStatus(atendimentos);
  renderizarRecentes(atendimentos);
}

// Os 5 números do topo: total e quantidade de cada status (com a % do total).
function renderizarIndicadores(m) {
  $("#kpiTotal").textContent = m.total;

  const indicadores = [
    ["kpiIA", m.emAtendimento],
    ["kpiAguardando", m.aguardandoHumano],
    ["kpiAssumidos", m.assumidos],
    ["kpiResolvidos", m.resolvidos]
  ];
  for (const [id, quantidade] of indicadores) {
    $(`#${id}`).textContent = quantidade;
    $(`#${id}Pct`).textContent = `${calcularPercentual(quantidade, m.total)}%`;
  }
}

// Cartão "Desempenho da IA": só as métricas que dá para calcular com os status.
function renderizarDesempenho(m) {
  // Conversas ainda não resolvidas
  const abertos = m.emAtendimento + m.aguardandoHumano + m.assumidos;

  // Das conversas em aberto, quantas a IA está conduzindo
  const comIA = calcularPercentual(m.emAtendimento, abertos);
  $("#metricaIA").textContent = abertos === 0 ? "—" : `${comIA}%`;
  $("#barraIA").style.width = `${comIA}%`;

  // Do total, quantos já foram resolvidos (não dá para separar IA e atendente)
  const resolvidos = calcularPercentual(m.resolvidos, m.total);
  $("#metricaResolucao").textContent = m.total === 0 ? "—" : `${resolvidos}%`;
  $("#barraResolucao").style.width = `${resolvidos}%`;
}

// Cartão "Status dos atendimentos": uma barra para cada status.
function renderizarResumoStatus(atendimentos) {
  const ordem = [STATUS.EM_ATENDIMENTO, STATUS.AGUARDANDO_HUMANO, STATUS.ASSUMIDO, STATUS.RESOLVIDO];
  let resumo = "";

  for (const status of ordem) {
    const quantidade = atendimentos.filter((a) => a.status === status).length;
    const percentual = calcularPercentual(quantidade, atendimentos.length);
    resumo += `
        <li>
          <span>${ROTULO_STATUS[status]}</span>
          <strong>${quantidade}</strong>
          <div class="barra-progresso barra-${status}"><span class="barra-preenchida" style="width:${percentual}%"></span></div>
        </li>`;
  }
  $("#resumoStatus").innerHTML = resumo;
}

// Cartão "Atendimentos recentes": os 4 primeiros da lista, com link para a conversa.
function renderizarRecentes(atendimentos) {
  let recentes = "";

  for (const atendimento of atendimentos.slice(0, 4)) {
    const ultima = atendimento.mensagens[atendimento.mensagens.length - 1];
    recentes += `
        <li>
          <a href="#whatsapp/${atendimento.id}">
            <span class="avatar avatar-pequeno avatar-cor-${corAvatar(atendimento.cliente)}">${iniciais(atendimento.cliente)}</span>
            <div>
              <strong>${escapar(atendimento.cliente)}</strong>
              <p>${escapar(ultima?.texto ?? "Abra a conversa para ver as mensagens")}</p>
            </div>
            ${badgeStatus(atendimento.status)}
          </a>
        </li>`;
  }

  if (!recentes) recentes = '<li class="lista-vazia">Nenhum atendimento ainda.</li>';
  $("#listaRecentes").innerHTML = recentes;
}

/* ---------- Cartões sem dados no sistema ---------- */

// A origem dos clientes (Instagram, link direto...) ainda não é salva no banco.
function mostrarOrigemSemDados() {
  $("#donutTotal").textContent = "—";
  $("#graficoOrigem").setAttribute("aria-label", "Sem dados de origem dos clientes");
  $("#legendaOrigem").innerHTML = `
    <li class="nota-dados">
      A origem dos clientes (Instagram, link direto…) ainda não é registrada no sistema.
      Quando for salva no banco, o gráfico poderá ser preenchido.
    </li>`;
}

// O sistema ainda não registra vendas: mostra só as linhas de fundo do
// gráfico e um aviso em texto normal logo abaixo.
// (O aviso não fica dentro do SVG porque o gráfico estica para ocupar a
// largura do cartão, e um texto dentro dele ficaria deformado.)
function mostrarVendasSemDados() {
  $("#valorVendas").textContent = "Sem dados";
  $("#valorVendas").classList.add("vendas-sem-dados"); // texto menor e mais claro
  $("#tendenciaVendas").hidden = true; // não há variação para mostrar

  const grafico = $("#graficoVendas");
  grafico.innerHTML = `
    <line class="grafico-linha-guia" x1="0" x2="300" y1="30" y2="30"/>
    <line class="grafico-linha-guia" x1="0" x2="300" y1="60" y2="60"/>
    <line class="grafico-linha-guia" x1="0" x2="300" y1="90" y2="90"/>`;
  grafico.setAttribute("aria-label", "Sem dados de vendas: o sistema ainda não registra vendas");

  // Cria o aviso só uma vez
  if (!$("#notaVendas")) {
    grafico.insertAdjacentHTML("afterend",
      '<p class="nota-dados nota-vendas" id="notaVendas">O sistema ainda não registra vendas. ' +
      "Quando os pedidos forem salvos no banco, o gráfico mostrará a evolução.</p>");
  }
}
