/**
 * Gera uma passphrase forte: 12 palavras PT-BR aleatórias + 5 dígitos.
 *
 * Uso:
 *   bun run scripts/password-admin/generate.ts
 *
 * Saída de exemplo:
 *   trovao-navalha-volpina-grampo-barranco-tucano-pomba-silvar-saudade-vespa-fronha-azulejo-83417
 *
 * Próximos passos:
 *   1. Copie a passphrase pro seu password manager (1Password / Bitwarden).
 *   2. Rode: bun run scripts/password-admin/hash.ts "<passphrase>"
 *   3. Cole o hash entre aspas SIMPLES no .env (ADMIN_PASSPHRASE_HASH=).
 *   4. Limpe o terminal: Clear-Host
 *
 * Entropia: 256 palavras × 12 = 96 bits + 5 dígitos = ~112 bits totais.
 * Praticamente intransitável por força bruta moderna.
 */
import { randomInt } from "node:crypto";

const WORDS = [
  // a (22)
  "abacate", "abacaxi", "abelha", "abrigo", "acerola", "agua", "alecrim", "alegre",
  "aldeia", "almofada", "amarelo", "amigo", "amora", "ancora", "andorinha", "areia",
  "armadilha", "arvore", "atalho", "aurora", "avesso", "azulejo",
  // b (12)
  "bambu", "banana", "bandeira", "barranco", "batata", "bateria", "bigode", "biscoito",
  "boneca", "borboleta", "brinco", "bruxa",
  // c (29)
  "cabana", "cacau", "cadeira", "caderno", "calmo", "camelo", "caminho", "canela",
  "canguru", "capacete", "capivara", "carro", "casaco", "castanha", "cavalo",
  "cereja", "chave", "chuva", "coelho", "colibri", "copo", "corda", "cortina",
  "costela", "coxinha", "cravo", "cristal", "cuidado", "curumim",
  // d (6)
  "dengoso", "dinheiro", "doce", "donzela", "dormir", "dragao",
  // e (10)
  "eclipse", "embarque", "encanto", "ensaio", "escola", "espelho", "esquilo",
  "esquina", "estrela", "estudio",
  // f (16)
  "faceiro", "falcao", "familia", "faroeste", "fechadura", "festa", "figado",
  "filhote", "filme", "flauta", "floresta", "fogueira", "folha", "formiga",
  "fortuna", "fronha",
  // g (10)
  "gaivota", "galera", "garoa", "girafa", "grampo", "granito", "gritar", "guarani",
  "guarda", "gulodice",
  // h (4)
  "hibrido", "historia", "hortela", "humilde",
  // i (4)
  "iguana", "imagem", "ipanema", "irrigador",
  // j (8)
  "jabuticaba", "jacare", "janela", "jardim", "jasmim", "javali", "jiboia", "joaninha",
  // k (4)
  "kibe", "kimono", "kiwi", "koala",
  // l (10)
  "lagarto", "lanterna", "leao", "libelo", "lichia", "limao", "lince",
  "livreiro", "lobo", "lufada",
  // m (24)
  "macaco", "machado", "malabarista", "manga", "manjerona", "mar", "mariposa",
  "marinheiro", "martelo", "mascote", "matraca", "medusa", "melao", "menina",
  "mestre", "milho", "mochila", "moeda", "moleque", "morango", "morcego",
  "mosaico", "mostarda", "mussarela",
  // n (8)
  "nadador", "navalha", "neblina", "nene", "ninho", "noiva", "noticia", "novelo",
  // o (8)
  "oceano", "oficial", "olaria", "ombro", "onibus", "orquidea", "ouro", "ovelha",
  // p (32)
  "pacato", "padaria", "padrinho", "paineira", "paleta", "palhaco", "pamonha",
  "panela", "papagaio", "paralelo", "passaro", "pedreira", "peixe", "penugem",
  "pequi", "perola", "petisco", "pinheiro", "pirata", "plumagem", "pomar",
  "pombo", "poncho", "ponte", "popular", "porao", "porto", "potro", "pracinha",
  "prato", "prima", "punhal",
  // q (8)
  "quadro", "quaresma", "quartzo", "quati", "queijo", "queimada", "quente", "quintal",
  // r (15)
  "rabanete", "rabisco", "raio", "rainha", "ramo", "raposa", "ravina",
  "redondo", "regiao", "remedio", "rio", "ritmo", "rodada", "romance", "rosa",
  // s (22)
  "sabia", "saci", "saia", "sala", "salgado", "sambar", "sandalia", "sapato",
  "sapo", "sargento", "saudade", "saxofone", "selva", "sereia", "sertao", "silvar",
  "sobrado", "sombrinha", "sonata", "sonho", "sopa", "sorvete",
  // t (16)
  "tabuleiro", "tagarela", "talheres", "tamarindo", "tapete", "tapir", "tatu",
  "tempestade", "terra", "tigela", "tigre", "tomate", "torre", "trevo", "trovao",
  "tucano",
  // u (3)
  "umbral", "urbano", "urso",
  // v (10)
  "vagao", "vaqueiro", "vassoura", "vela", "veleiro", "ventania", "verde", "vespa",
  "violao", "violeta",
  // x (4)
  "xadrez", "xale", "xerife", "xicara",
  // z (4)
  "zangao", "zebra", "zelo", "zinco",
];

const N_WORDS = 12;
const N_DIGITS = 5;

const words = Array.from({ length: N_WORDS }, () => WORDS[randomInt(0, WORDS.length)]);
const digits = Array.from({ length: N_DIGITS }, () => randomInt(0, 10)).join("");
const passphrase = `${words.join("-")}-${digits}`;

console.log("\n────────────────────────────────────────────────────────────────");
console.log(" Passphrase gerada:");
console.log("────────────────────────────────────────────────────────────────\n");
console.log("  " + passphrase);
console.log("\n────────────────────────────────────────────────────────────────");
console.log(" Próximos passos:");
console.log("────────────────────────────────────────────────────────────────");
console.log(" 1. Copie pro 1Password/Bitwarden AGORA (ela não fica salva aqui).");
console.log(" 2. Gere o hash:");
console.log("      bun run scripts/password-admin/hash.ts \"" + passphrase + "\"");
console.log(" 3. Cole o hash entre ASPAS SIMPLES no .env.");
console.log(" 4. Limpe o terminal: Clear-Host\n");
console.log(" Entropia: ~" + Math.round(Math.log2(WORDS.length) * N_WORDS + Math.log2(10) * N_DIGITS) + " bits — praticamente intransitável.\n");
