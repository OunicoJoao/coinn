/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18),
 * ver histórico (#19), editar e excluir (#20).
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
const formContainerEl = document.getElementById("form-container");
const tituloFormEl = document.getElementById("titulo-form");
const formEl = document.getElementById("form-movimentacao");
const descricaoEl = document.getElementById("descricao");
const contadorEl = document.getElementById("contador-descricao");
const valorEl = document.getElementById("valor");
const dataEl = document.getElementById("data");
const erroEl = document.getElementById("mensagem-erro");
const btnRegistrarEl = document.getElementById("btn-registrar");
const btnCancelarEdicaoEl = document.getElementById("btn-cancelar-edicao");

// ---------- Estado ----------

let movimentacoes = Armazenamento.carregarMovimentacoes();

// id da movimentação sendo editada; null quando o formulário está criando uma nova
let idEmEdicao = null;

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hoje();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);
btnCancelarEdicaoEl.addEventListener("click", cancelarEdicao);

// Um único listener na lista cuida dos botões de todos os itens (delegação de eventos),
// assim não é preciso usar onclick no HTML gerado
listaEl.addEventListener("click", tratarCliqueNaLista);

atualizarContador();
atualizarTela();

// ---------- #17 Registrar movimentação (e salvar edição) ----------

function registrarMovimentacao(evento) {
    evento.preventDefault(); // evita recarregar a página

    const dados = lerFormulario();
    const erro = Regras.validarMovimentacao(dados);
    if (erro) {
        mostrarErro(erro);
        return;
    }

    const novaLista = idEmEdicao !== null
        ? Regras.editarMovimentacao(movimentacoes, idEmEdicao, dados, new Date().toISOString())
        : Regras.adicionarMovimentacao(movimentacoes, dados, Date.now());

    if (!Armazenamento.salvarMovimentacoes(novaLista)) {
        mostrarErro("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    movimentacoes = novaLista;
    sairModoEdicao();
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

// ---------- #20 Editar movimentação ----------

// Preenche o formulário com os dados da movimentação e troca para o modo de edição
function iniciarEdicao(id) {
    const mov = movimentacoes.find((m) => m.id === id);
    if (!mov) return;

    idEmEdicao = id;

    const radioTipo = formEl.querySelector(`input[name="tipo"][value="${mov.tipo}"]`);
    if (radioTipo) radioTipo.checked = true;
    valorEl.value = mov.valor;
    dataEl.value = mov.data;
    descricaoEl.value = mov.descricao;

    tituloFormEl.textContent = "Editar movimentação";
    btnRegistrarEl.textContent = "Salvar alterações";
    btnCancelarEdicaoEl.hidden = false;
    formContainerEl.classList.add("editando");

    esconderErro();
    atualizarContador();
    destacarItemEmEdicao();

    // No celular o formulário pode estar fora da tela
    formContainerEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    valorEl.focus({ preventScroll: true });
}

function cancelarEdicao() {
    sairModoEdicao();
}

// Volta o formulário para o modo "Nova movimentação"
function sairModoEdicao() {
    idEmEdicao = null;
    tituloFormEl.textContent = "Nova movimentação";
    btnRegistrarEl.textContent = "Registrar";
    btnCancelarEdicaoEl.hidden = true;
    formContainerEl.classList.remove("editando");
    destacarItemEmEdicao();
    limparFormulario();
}

// Marca na lista o item aberto no formulário, sem redesenhar a lista
// (redesenhar faria a animação de entrada de todos os itens rodar de novo)
function destacarItemEmEdicao() {
    listaEl.querySelectorAll(".movimentacao").forEach((li) => {
        li.classList.toggle("editando", Number(li.dataset.id) === idEmEdicao);
    });
}

// ---------- #20 Excluir movimentação ----------

function excluirMovimentacao(id) {
    const mov = movimentacoes.find((m) => m.id === id);
    if (!mov) return;

    const confirmou = confirm(`Excluir "${mov.descricao}" (${Regras.formatarData(mov.data)})?`);
    if (!confirmou) return;

    const novaLista = Regras.excluirMovimentacao(movimentacoes, id);

    if (!Armazenamento.salvarMovimentacoes(novaLista)) {
        mostrarErro("Não foi possível excluir. Verifique se o navegador permite armazenamento local.");
        return;
    }

    movimentacoes = novaLista;

    // Se a movimentação excluída estava aberta no formulário, sai da edição
    if (idEmEdicao === id) {
        sairModoEdicao();
    }

    atualizarTela();
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
    li.dataset.id = mov.id;
    if (mov.id === idEmEdicao) li.classList.add("editando");

    const info = document.createElement("div");
    info.classList.add("movimentacao-info");

    const descricao = document.createElement("span");
    descricao.classList.add("movimentacao-descricao");
    descricao.textContent = mov.descricao;

    const detalhe = document.createElement("span");
    detalhe.classList.add("movimentacao-data");
    detalhe.textContent = `${Regras.formatarData(mov.data)} · ${ehEntrada ? "Entrada" : "Saída"}`;

    info.append(descricao, detalhe);

    const lado = document.createElement("div");
    lado.classList.add("movimentacao-lado");

    const valor = document.createElement("span");
    valor.classList.add("movimentacao-valor");
    valor.textContent = (ehEntrada ? "+ " : "- ") + Regras.formatarMoeda(mov.valor);

    const acoes = document.createElement("div");
    acoes.classList.add("movimentacao-acoes");
    acoes.append(
        criarBotaoAcao("editar", "✎", `Editar ${mov.descricao}`, mov.id),
        criarBotaoAcao("excluir", "×", `Excluir ${mov.descricao}`, mov.id)
    );

    lado.append(valor, acoes);
    li.append(info, lado);
    return li;
}

function criarBotaoAcao(acao, simbolo, rotulo, id) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.classList.add("btn-acao", `btn-${acao}`);
    botao.textContent = simbolo;
    botao.title = rotulo;
    botao.setAttribute("aria-label", rotulo);
    botao.dataset.acao = acao;
    botao.dataset.id = id;
    return botao;
}

// Descobre qual botão foi clicado dentro da lista e chama a função certa
function tratarCliqueNaLista(evento) {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;

    const id = Number(botao.dataset.id);
    if (botao.dataset.acao === "editar") {
        iniciarEdicao(id);
    } else if (botao.dataset.acao === "excluir") {
        excluirMovimentacao(id);
    }
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
