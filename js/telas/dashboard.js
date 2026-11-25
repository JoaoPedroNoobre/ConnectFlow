/* ==========================================================================
   Tela 1 — Dashboard
   Métricas de atendimentos, clientes, conversões e desempenho da IA.
   ========================================================================== */

import { STATUS } from "../atendimentos.js";
import { periodosDemo } from "../dados-demo.js";
import { listarAtendimentos, inscrever } from "../estado.js";
import { $, escapar, iniciais, corAvatar, badgeStatus, formatarPreco, ROTULO_STATUS } from "../ui.js";

const ORIGENS = [
  { chave: "instagramPosts", rotulo: "Instagram (posts)", cor: "#8b5cf6" },
  { chave: "instagramDirect", rotulo: "Instagram (direct)", cor: "#6366f1" },
  { chave: "outros", rotulo: "Outros", cor: "#22d3ee" },
  { chave: "linkDireto", rotulo: "Link direto", cor: "#a78bfa" }
];

const pct = (parte, total) => `${((parte / total) * 100).toFixed(1).replace(".", ",")}%`;

export function iniciarDashboard() {
  const seletor = $("#filtroPeriodo");
  seletor.addEventListener("change", () => renderizarPeriodo(seletor.value));
  renderizarPeriodo(seletor.value);

  renderizarAtendimentos(listarAtendimentos());
  inscrever(renderizarAtendimentos);
}

function renderizarPeriodo(chave) {
  const p = periodosDemo[chave];
  const total = p.finalizadosIA + p.emTratamento + p.naoConcluidos + p.intervencaoHumana;

  // KPIs
  $("#kpiClientes").textContent = total.toLocaleString("pt-BR");
  $("#kpiClientesTend").textContent = `+${p.tendencia.clientes}%`;
  $("#kpiFinalizados").textContent = p.finalizadosIA.toLocaleString("pt-BR");
  $("#kpiFinalizadosPct").textContent = pct(p.finalizadosIA, total);
  $("#kpiTratamento").textContent = p.emTratamento.toLocaleString("pt-BR");
  $("#kpiTratamentoPct").textContent = pct(p.emTratamento, total);
  $("#kpiNaoConcluidos").textContent = p.naoConcluidos.toLocaleString("pt-BR");
  $("#kpiNaoConcluidosPct").textContent = pct(p.naoConcluidos, total);
  $("#kpiIntervencao").textContent = p.intervencaoHumana.toLocaleString("pt-BR");
  $("#kpiIntervencaoPct").textContent = pct(p.intervencaoHumana, total);

  // Desempenho da IA: resolução = finalizados pela IA / total
  const resolucao = Math.round((p.finalizadosIA / total) * 100);
  $("#metricaResolucao").textContent = `${resolucao}%`;
  $("#barraResolucao").style.width = `${resolucao}%`;

  renderizarOrigem(p.origem, total);
  renderizarVendas(p);
}

/* Gráfico de rosca: um círculo pintado com fatias coloridas (conic-gradient) */
function renderizarOrigem(origem, total) {
  // Onde cada fatia termina, somando as porcentagens (ex.: 58%, 75%, 90%)
  const fim1 = origem[ORIGENS[0].chave];
  const fim2 = fim1 + origem[ORIGENS[1].chave];
  const fim3 = fim2 + origem[ORIGENS[2].chave];
  $("#graficoOrigem").style.backgroundImage =
    `conic-gradient(${ORIGENS[0].cor} 0 ${fim1}%, ${ORIGENS[1].cor} ${fim1}% ${fim2}%, ` +
    `${ORIGENS[2].cor} ${fim2}% ${fim3}%, ${ORIGENS[3].cor} ${fim3}% 100%)`;
  $("#donutTotal").textContent = total.toLocaleString("pt-BR");

  $("#legendaOrigem").innerHTML = ORIGENS.map((o) => `
    <li>
      <span class="legenda-cor" style="background-color:${o.cor}"></span>
      <span class="legenda-nome">${o.rotulo}</span>
      <strong>${origem[o.chave]}%</strong>
    </li>`).join("");
}

/* Gráfico de linha em SVG gerado a partir da série do período */
function renderizarVendas(p) {
  $("#valorVendas").textContent = formatarPreco(p.vendas);
  $("#tendenciaVendas").textContent = `+${p.tendenciaVendas}%`;

  const largura = 300, altura = 120, margem = 8;
  const serie = p.serieVendas;
  const max = Math.max(...serie), min = Math.min(...serie);
  const pontos = serie.map((v, i) => {
    const x = (i / (serie.length - 1)) * largura;
    const y = altura - margem - ((v - min) / (max - min || 1)) * (altura - margem * 3);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const linha = pontos.map(([x, y]) => `${x},${y}`).join(" ");
  const grade = [0.25, 0.5, 0.75].map((f) => `<line class="grafico-linha-guia" x1="0" x2="${largura}" y1="${altura * f}" y2="${altura * f}"/>`).join("");

  $("#graficoVendas").innerHTML = `
    <defs>
      <linearGradient id="gradVendas" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#22c55e" stop-opacity=".35"/>
        <stop offset="1" stop-color="#22c55e" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grade}
    <polygon class="grafico-linha-area" points="0,${altura} ${linha} ${largura},${altura}"/>
    <polyline class="grafico-linha-traco" points="${linha}"/>
    ${pontos.map(([x, y]) => `<circle class="grafico-linha-ponto" cx="${x}" cy="${y}" r="3"/>`).join("")}`;
}

/* Atualizado em tempo real quando um status muda na tela de WhatsApp */
function renderizarAtendimentos(atendimentos) {
  const total = atendimentos.length || 1;
  const ordem = [STATUS.EM_ATENDIMENTO, STATUS.AGUARDANDO_HUMANO, STATUS.ASSUMIDO, STATUS.RESOLVIDO];

  $("#resumoStatus").innerHTML = ordem
    .map((status) => {
      const qtd = atendimentos.filter((a) => a.status === status).length;
      return `
        <li>
          <span>${ROTULO_STATUS[status]}</span>
          <strong>${qtd}</strong>
          <div class="barra-progresso barra-${status}"><span class="barra-preenchida" style="width:${(qtd / total) * 100}%"></span></div>
        </li>`;
    })
    .join("");

  $("#listaRecentes").innerHTML = atendimentos
    .slice(0, 4)
    .map((a) => {
      const ultima = a.mensagens.at(-1);
      return `
        <li>
          <a href="#whatsapp/${a.id}">
            <span class="avatar avatar-pequeno avatar-cor-${corAvatar(a.cliente)}">${iniciais(a.cliente)}</span>
            <div>
              <strong>${escapar(a.cliente)}</strong>
              <p>${escapar(ultima?.texto ?? "Novo atendimento")}</p>
            </div>
            ${badgeStatus(a.status)}
          </a>
        </li>`;
    })
    .join("");
}
