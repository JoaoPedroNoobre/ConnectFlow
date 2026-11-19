
import { responderCliente } from "../js/ia.js";

const produtos = [
  { nome: "Corte masculino", preco: 35 },
  { nome: "Barba", preco: 20 },
  { nome: "Sobrancelha", preco: 15 }
];

// Teste 1 - Consultar um serviço
console.log(responderCliente(
  "Quanto custa o Corte masculino?",
  produtos,
  true
));

// Teste 2 - Serviço não encontrado
console.log(responderCliente(
  "Vocês vendem shampoo?",
  produtos,
  true
));

// Teste 3 - IA pausada
console.log(responderCliente(
  "Quanto custa a Barba?",
  produtos,
  false
));
