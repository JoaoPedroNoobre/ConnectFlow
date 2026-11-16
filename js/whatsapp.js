
/* Gerador de Link para o WhatsApp */

export function gerarLinkWhatsApp(telefone, mensagem = "") {
  const numero = String(telefone).replace(/\D/g, "");

  if (!/^[1-9]\d{9,14}$/.test(numero)) {
    throw new Error("Informe um telefone válido com DDI.");
  }

  const texto = mensagem.trim()
    ? `?text=${encodeURIComponent(mensagem.trim())}`
    : "";

  return `https://wa.me/${numero}${texto}`;
}
