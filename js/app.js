/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18),
 * e ver histórico (#19).
 *
 * Este arquivo só cuida da tela (ler o formulário, desenhar a lista, reagir a cliques).
 * - As regras de negócio (validar, calcular, ordenar) ficam em regras.js.
 * - O acesso aos dados fica em storage.js.
 */

/* global Regras, Armazenamento */

// ---------- Constantes ----------

const { TIPO, LIMITES } = Regras;

// ---------- Elementos da página ----------

const saldoEl = document.getElementById("saldo");
const totalEntradasEl = document.getElementById("total-entradas");
const totalSaidasEl = document.getElementById("total-saidas");
const listaEl = document.getElementById("lista-movimentacoes");
const historicoVazioEl = document.getElementById("historico-vazio");
const formEl = document.getElementById("form-movimentacao");
const descricaoEl = document.getElementById("descricao");
const contadorEl = document.getElementById("contador-descricao");
const valorEl = document.getElementById("valor");
const dataEl = document.getElementById("data");
const erroEl = document.getElementById("mensagem-erro");

// ---------- Estado ----------

let movimentacoes = Armazenamento.carregarMovimentacoes();

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hoje();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);

atualizarContador();
atualizarTela();

// ---------- #17 Registrar movimentação ----------

function registrarMovimentacao(evento) {
    evento.preventDefault(); // evita recarregar a página

    const dados = lerFormulario();
    const erro = Regras.validarMovimentacao(dados);
    if (erro) {
        mostrarErro(erro);
        return;
    }

    const novaLista = Regras.adicionarMovimentacao(movimentacoes, dados, Date.now());

    if (!Armazenamento.salvarMovimentacoes(novaLista)) {
        mostrarErro("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    movimentacoes = novaLista;
    limparFormulario();
    atualizarTela();
}

function lerFormulario() {
    const tipoMarcado = formEl.querySelector('input[name="tipo"]:checked');
    return {
        tipo: tipoMarcado ? tipoMarcado.value : "",
        valor: Number(valorEl.value),
        data: dataEl.value,
        descricao: descricaoEl.value.trim()
    };
}

function limparFormulario() {
    formEl.reset();
    dataEl.value = hoje();
    esconderErro();
    atualizarContador();
    descricaoEl.focus();
}

// ---------- #18 Consultar saldo ----------

function atualizarResumo() {
    const { entradas, saidas, saldo } = Regras.calcularResumo(movimentacoes);

    saldoEl.textContent = Regras.formatarMoeda(saldo);
    saldoEl.classList.toggle("negativo", saldo < 0);
    totalEntradasEl.textContent = Regras.formatarMoeda(entradas);
    totalSaidasEl.textContent = Regras.formatarMoeda(saidas);
}

// ---------- #19 Ver histórico ----------

function atualizarHistorico() {
    listaEl.replaceChildren(); // limpa a lista

    const visiveis = Regras.ordenarHistorico(movimentacoes);

    visiveis.forEach((mov) => listaEl.appendChild(criarItemHistorico(mov)));

    historicoVazioEl.hidden = visiveis.length > 0;
}

// Monta o item com textContent (nunca innerHTML) para o texto digitado
// pelo usuário não ser interpretado como HTML
function criarItemHistorico(mov) {
    const ehEntrada = mov.tipo === TIPO.ENTRADA;

    const li = document.createElement("li");
    li.classList.add("movimentacao", ehEntrada ? "entrada" : "saida");

    const info = document.createElement("div");
    info.classList.add("movimentacao-info");

    const descricao = document.createElement("span");
    descricao.classList.add("movimentacao-descricao");
    descricao.textContent = mov.descricao;

    const detalhe = document.createElement("span");
    detalhe.classList.add("movimentacao-data");
    detalhe.textContent = `${Regras.formatarData(mov.data)} · ${ehEntrada ? "Entrada" : "Saída"}`;

    info.append(descricao, detalhe);

    const valor = document.createElement("span");
    valor.classList.add("movimentacao-valor");
    valor.textContent = (ehEntrada ? "+ " : "- ") + Regras.formatarMoeda(mov.valor);

    li.append(info, valor);
    return li;
}

// ---------- Utilitários da tela ----------

function atualizarTela() {
    atualizarResumo();
    atualizarHistorico();
}

function atualizarContador() {
    contadorEl.textContent = `${descricaoEl.value.length}/${LIMITES.DESCRICAO_MAX}`;
}

function mostrarErro(mensagem) {
    erroEl.textContent = mensagem;
    erroEl.hidden = false;
}

function esconderErro() {
    erroEl.textContent = "";
    erroEl.hidden = true;
}

function hoje() {
    return Regras.dataISO(new Date());
}
