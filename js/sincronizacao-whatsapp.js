// Os eventos avisam o painel. A leitura seguinte traz os dados atuais do servidor.
export async function iniciarSincronizacaoWhatsapp({
  lerModo, atualizar, mostrar, abrirEventos = () => new EventSource("/api/eventos"),
  agendar = setTimeout, cancelar = clearTimeout
}) {
  let eventos;
  let conectado = false;
  let atualizando = false;
  let pendente = false;
  let espera;

  function cancelarEspera() {
    if (espera !== undefined) cancelar(espera);
    espera = undefined;
  }

  async function receberAtualizacao() {
    pendente = true;
    if (atualizando || !conectado) return;
    cancelarEspera();
    atualizando = true;
    try {
      while (pendente && conectado) {
        pendente = false;
        await atualizar();
        if (conectado) mostrar("WhatsApp Cloud API · modo real");
      }
    } catch {
      if (conectado) {
        mostrar("WhatsApp Cloud API · atualização indisponível");
        espera = agendar(receberAtualizacao, 2000);
      }
    } finally {
      atualizando = false;
    }
  }

  async function conectar() {
    try {
      if (!await lerModo()) {
        mostrar("Simulador · desenvolvimento");
        return;
      }
      eventos = abrirEventos();
      eventos.addEventListener("atualizar", () => {
        conectado = true;
        return receberAtualizacao();
      });
      eventos.onerror = () => {
        conectado = false;
        cancelarEspera();
        mostrar(eventos.readyState === 2
          ? "WhatsApp Cloud API · conexão encerrada. Recarregue a página."
          : "WhatsApp Cloud API · reconectando…");
      };
    } catch {
      mostrar("Conexão com o painel indisponível. Tentando novamente…");
      espera = agendar(conectar, 2000);
    }
  }

  await conectar();
}
