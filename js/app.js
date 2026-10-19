/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18)
 * e ver histórico (#19). O acesso aos dados fica em storage.js.
 *
 * Modelo de dados de uma movimentação:
 *   { id, tipo ("entrada" | "saida"), valor, data ("AAAA-MM-DD"), descricao }
 */

// ---------- Constantes ----------

// "Enum" de tipos: use sempre estas constantes em vez de digitar o texto
const TIPO = Object.freeze({
    ENTRADA: "entrada",
    SAIDA: "saida"
});

const LIMITES = Object.freeze({
    DESCRICAO_MAX: 30,
    VALOR_MIN: 0.01,
    VALOR_MAX: 999999.99
});

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

let movimentacoes = carregarMovimentacoes();

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hojeISO();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);

atualizarContador();
atualizarTela();

// ---------- #17 Registrar movimentação ----------

function registrarMovimentacao(evento) {
    evento.preventDefault(); // evita recarregar a página

    const tipoMarcado = formEl.querySelector('input[name="tipo"]:checked');
    const dados = {
        tipo: tipoMarcado ? tipoMarcado.value : "",
        valor: Number(valorEl.value),
        data: dataEl.value,
        descricao: descricaoEl.value.trim()
    };

    const erro = validar(dados);
    if (erro) {
        mostrarErro(erro);
        return;
    }

    const novaMovimentacao = {
        id: Date.now(),
        tipo: dados.tipo,
        valor: Math.round(dados.valor * 100) / 100, // guarda com 2 casas decimais
        data: dados.data,
        descricao: dados.descricao
    };

    const novaLista = [...movimentacoes, novaMovimentacao];
    if (!salvarMovimentacoes(novaLista)) {
        mostrarErro("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    movimentacoes = novaLista;
    limparFormulario();
    atualizarTela();
}

// Retorna uma mensagem de erro, ou null se os dados estiverem inválidos
function validar({ tipo, valor, data, descricao }) {
    if (tipo !== TIPO.ENTRADA && tipo !== TIPO.SAIDA) {
        return "Escolha se é uma entrada ou uma saída.";
    }
    if (!Number.isFinite(valor) || valor < LIMITES.VALOR_MIN) {
        return "Informe um valor maior que zero.";
    }
    if (valor > LIMITES.VALOR_MAX) {
        return `O valor máximo é ${formatarMoeda(LIMITES.VALOR_MAX)}.`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return "Informe uma data válida.";
    }
    if (descricao.length === 0) {
        return "Informe uma descrição.";
    }
    if (descricao.length > LIMITES.DESCRICAO_MAX) {
        return `A descrição pode ter no máximo ${LIMITES.DESCRICAO_MAX} caracteres.`;
    }
    return null;
}

function limparFormulario() {
    formEl.reset();
    dataEl.value = hojeISO();
    esconderErro();
    atualizarContador();
    descricaoEl.focus();
}

// ---------- #18 Consultar saldo ----------

function atualizarResumo() {
    const totalEntradas = somarPorTipo(TIPO.ENTRADA);
    const totalSaidas = somarPorTipo(TIPO.SAIDA);
    const saldo = totalEntradas - totalSaidas;

    saldoEl.textContent = formatarMoeda(saldo);
    saldoEl.classList.toggle("negativo", saldo < 0);
    totalEntradasEl.textContent = formatarMoeda(totalEntradas);
    totalSaidasEl.textContent = formatarMoeda(totalSaidas);
}

function somarPorTipo(tipo) {
    return movimentacoes
        .filter((mov) => mov.tipo === tipo)
        .reduce((total, mov) => total + mov.valor, 0);
}

// ---------- #19 Ver histórico ----------

function atualizarHistorico() {
    listaEl.replaceChildren(); // limpa a lista

    // Mais recente primeiro: ordena pela data e, no mesmo dia, pela ordem de registro
    const ordenadas = [...movimentacoes].sort((a, b) => {
        if (a.data !== b.data) return a.data < b.data ? 1 : -1;
        return b.id - a.id;
    });

    ordenadas.forEach((mov) => listaEl.appendChild(criarItemHistorico(mov)));
    historicoVazioEl.hidden = ordenadas.length > 0;
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
    detalhe.textContent = `${formatarData(mov.data)} · ${ehEntrada ? "Entrada" : "Saída"}`;

    info.append(descricao, detalhe);

    const valor = document.createElement("span");
    valor.classList.add("movimentacao-valor");
    valor.textContent = (ehEntrada ? "+ " : "- ") + formatarMoeda(mov.valor);

    li.append(info, valor);
    return li;
}

// ---------- Utilitários ----------

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

function formatarMoeda(numero) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(numero);
}

// "2026-10-14" -> "14/10/2026"
// (não usa new Date() porque ele interpreta a data em UTC e pode mostrar o dia anterior)
function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

// Data de hoje no fuso do usuário, no formato "AAAA-MM-DD"
function hojeISO() {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const dia = String(agora.getDate()).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}-${dia}`;
}
