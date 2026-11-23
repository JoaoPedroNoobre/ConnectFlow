/* ==========================================================================
   Tela 1 — Dashboard
   Métricas de atendimentos, clientes, conversões e desempenho da IA.
   ========================================================================== */

import { STATUS } from "../atendimentos.js";
import { semanaDemo } from "../dados-demo.js";
import { listarAtendimentos, inscrever } from "../estado.js";
import { $, escapar, iniciais, badgeStatus, ROTULO_STATUS } from "../ui.js";

export function iniciarDashboard() {
  renderizarKpis();
  renderizarGrafico();
  renderizarAtendimentos(listarAtendimentos());
  inscrever(renderizarAtendimentos);
}

function renderizarKpis() {
  const totalIA = semanaDemo.reduce((s, d) => s + d.ia, 0);
  const totalHumano = semanaDemo.reduce((s, d) => s + d.humano, 0);
  const total = totalIA + totalHumano;

  $("#kpiAtendimentos").textContent = total.toLocaleString("pt-BR");
  $("#kpiResolvidosIA").textContent = `${Math.round((totalIA / total) * 100)}%`;
}

function renderizarGrafico() {
  const maximo = Math.max(...semanaDemo.map((d) => d.ia + d.humano));

  $("#graficoSemana").innerHTML = semanaDemo
    .map(({ dia, ia, humano }) => {
      const pIA = (ia / maximo) * 100;
      const pHumano = (humano / maximo) * 100;
      return `
        <div class="bar-chart__col" tabindex="0">
          <div class="bar-chart__stack">
            <span class="bar-chart__tip">${dia}: ${ia} IA · ${humano} humano</span>
            <span class="bar-chart__seg bar-chart__seg--humano" style="height:${pHumano}%"></span>
            <span class="bar-chart__seg bar-chart__seg--ia" style="height:${pIA}%"></span>
          </div>
          <span class="bar-chart__label">${dia}</span>
        </div>`;
    })
    .join("");
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
          <div class="progress progress--${status}"><span style="--valor:${(qtd / total) * 100}%"></span></div>
        </li>`;
    })
    .join("");

  $("#listaRecentes").innerHTML = atendimentos
    .slice(0, 5)
    .map((a) => {
      const ultima = a.mensagens.at(-1);
      return `
        <li>
          <a href="#whatsapp/${a.id}">
            <span class="avatar avatar--sm">${iniciais(a.cliente)}</span>
            <div>
              <strong>${escapar(a.cliente)}</strong>
              <p>${escapar(ultima?.texto ?? "Novo atendimento")}</p>
            </div>
            <div class="recent-list__meta">
              ${badgeStatus(a.status)}
              <small>${escapar(ultima?.hora ?? "")}</small>
            </div>
          </a>
        </li>`;
    })
    .join("");
}
