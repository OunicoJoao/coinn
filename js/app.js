/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18),
 * ver histórico (#19), editar e excluir (#20) e limpar tudo.
 * Na barra do topo: mostrar/ocultar valores e exportar/importar os dados (#21).
 *
 * Este arquivo só cuida da tela (ler o formulário, desenhar a lista, reagir a cliques).
 * - As regras de negócio (validar, calcular, ordenar) ficam em regras.js.
 * - O acesso aos dados fica em storage.js.
 */

/* global Regras, Armazenamento */

// ---------- Constantes ----------

const { TIPO, LIMITES } = Regras;

// Texto mostrado no lugar dos valores quando o "olho" está fechado
const VALOR_OCULTO = "R$ •••••";

// Tempo que o aviso rápido fica na tela
const DURACAO_AVISO_MS = 3500;

// ---------- Elementos da página ----------

const saldoEl = document.getElementById("saldo");
const totalEntradasEl = document.getElementById("total-entradas");
const totalSaidasEl = document.getElementById("total-saidas");
const listaEl = document.getElementById("lista-movimentacoes");
const historicoVazioEl = document.getElementById("historico-vazio");
const btnLimparTudoEl = document.getElementById("btn-limpar-tudo");
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
const btnVisibilidadeEl = document.getElementById("btn-visibilidade");
const btnDadosEl = document.getElementById("btn-dados");
const menuDadosEl = document.getElementById("menu-dados");
const btnExportarEl = document.getElementById("btn-exportar");
const btnImportarEl = document.getElementById("btn-importar");
const arquivoImportarEl = document.getElementById("arquivo-importar");
const avisoEl = document.getElementById("aviso");

// ---------- Estado ----------

let movimentacoes = Armazenamento.carregarMovimentacoes();

// id da movimentação sendo editada; null quando o formulário está criando uma nova
let idEmEdicao = null;

// true = valores aparecem; false = aparecem como "R$ •••••"
let valoresVisiveis = Armazenamento.carregarValoresVisiveis();

// Guarda o timer do aviso para poder reiniciá-lo
let timerAviso = null;

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hoje();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);
btnCancelarEdicaoEl.addEventListener("click", cancelarEdicao);
btnLimparTudoEl.addEventListener("click", limparTudo);

// Um único listener na lista cuida dos botões de todos os itens (delegação de eventos),
// assim não é preciso usar onclick no HTML gerado
listaEl.addEventListener("click", tratarCliqueNaLista);

// Barra do topo
btnVisibilidadeEl.addEventListener("click", alternarVisibilidade);
btnDadosEl.addEventListener("click", alternarMenuDados);
btnExportarEl.addEventListener("click", exportarDados);
btnImportarEl.addEventListener("click", () => arquivoImportarEl.click());
arquivoImportarEl.addEventListener("change", importarDados);
document.addEventListener("click", fecharMenuAoClicarFora);
document.addEventListener("keydown", fecharMenuComEsc);

aplicarVisibilidade();
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

// ---------- Limpar tudo ----------

function limparTudo() {
    if (movimentacoes.length === 0) return;

    const quantidade = movimentacoes.length;
    const texto = quantidade === 1 ? "a movimentação registrada" : `as ${quantidade} movimentações registradas`;
    const confirmou = confirm(
        `Apagar ${texto}? Essa ação não pode ser desfeita.\n\n` +
        "Dica: use \"Exportar dados\" antes, para guardar uma cópia de segurança."
    );
    if (!confirmou) return;

    if (!Armazenamento.removerTodasMovimentacoes()) {
        mostrarErro("Não foi possível apagar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    movimentacoes = [];
    if (idEmEdicao !== null) {
        sairModoEdicao();
    }
    atualizarTela();
}

// ---------- #18 Consultar saldo ----------

function atualizarResumo() {
    const { entradas, saidas, saldo } = Regras.calcularResumo(movimentacoes);

    saldoEl.textContent = exibirValor(saldo);
    saldoEl.classList.toggle("negativo", saldo < 0 && valoresVisiveis);
    totalEntradasEl.textContent = exibirValor(entradas);
    totalSaidasEl.textContent = exibirValor(saidas);
}

// ---------- #19 Ver histórico ----------

function atualizarHistorico() {
    listaEl.replaceChildren(); // limpa a lista

    const temMovimentacoes = movimentacoes.length > 0;
    btnLimparTudoEl.hidden = !temMovimentacoes;

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
    valor.textContent = (ehEntrada ? "+ " : "- ") + exibirValor(mov.valor);

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

// ---------- Mostrar / ocultar valores (botão "olho") ----------

function alternarVisibilidade() {
    valoresVisiveis = !valoresVisiveis;
    Armazenamento.salvarValoresVisiveis(valoresVisiveis);
    aplicarVisibilidade();
    atualizarResumo();
    atualizarHistorico();
}

// Atualiza o botão (ícone, texto para leitor de tela) de acordo com o estado
function aplicarVisibilidade() {
    const rotulo = valoresVisiveis ? "Ocultar valores" : "Mostrar valores";
    btnVisibilidadeEl.setAttribute("aria-pressed", String(!valoresVisiveis));
    btnVisibilidadeEl.setAttribute("aria-label", rotulo);
    btnVisibilidadeEl.title = rotulo;
    document.body.classList.toggle("valores-ocultos", !valoresVisiveis);
}

// Valor formatado, ou "R$ •••••" se o olho estiver fechado
function exibirValor(numero) {
    return valoresVisiveis ? Regras.formatarMoeda(numero) : VALOR_OCULTO;
}

// ---------- Menu de exportar / importar ----------

function alternarMenuDados() {
    if (menuDadosEl.hidden) {
        abrirMenuDados();
    } else {
        fecharMenuDados();
    }
}

function abrirMenuDados() {
    menuDadosEl.hidden = false;
    btnDadosEl.setAttribute("aria-expanded", "true");
    btnExportarEl.focus();
}

function fecharMenuDados() {
    menuDadosEl.hidden = true;
    btnDadosEl.setAttribute("aria-expanded", "false");
}

function fecharMenuAoClicarFora(evento) {
    if (menuDadosEl.hidden) return;
    if (!evento.target.closest(".menu-dados")) fecharMenuDados();
}

function fecharMenuComEsc(evento) {
    if (evento.key === "Escape" && !menuDadosEl.hidden) {
        fecharMenuDados();
        btnDadosEl.focus();
    }
}

// ---------- #21 Exportar dados ----------

// Gera um arquivo .json com todas as movimentações e faz o download
function exportarDados() {
    fecharMenuDados();

    if (movimentacoes.length === 0) {
        mostrarAviso("Não há movimentações para exportar.", "erro");
        return;
    }

    const conteudo = Regras.montarExportacao(movimentacoes, new Date().toISOString());
    const arquivo = new Blob([JSON.stringify(conteudo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(arquivo);

    // Cria um link temporário só para disparar o download
    const link = document.createElement("a");
    link.href = url;
    link.download = `coinn-movimentacoes-${hoje()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    const quantidade = movimentacoes.length;
    mostrarAviso(`${quantidade} ${quantidade === 1 ? "movimentação exportada" : "movimentações exportadas"}.`);
}

// ---------- #21 Importar dados ----------

async function importarDados() {
    fecharMenuDados();

    const arquivo = arquivoImportarEl.files[0];
    arquivoImportarEl.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!arquivo) return;

    let conteudo;
    try {
        conteudo = JSON.parse(await arquivo.text());
    } catch {
        mostrarAviso("Esse arquivo não é um JSON válido.", "erro");
        return;
    }

    const agora = Date.now();
    const resultado = Regras.lerMovimentacoesImportadas(conteudo, (indice) => agora + indice);
    if (resultado.erro) {
        mostrarAviso(resultado.erro, "erro");
        return;
    }

    const importadas = resultado.lista;
    const qtdImportadas = importadas.length;
    const textoImportadas = `${qtdImportadas} ${qtdImportadas === 1 ? "movimentação" : "movimentações"}`;

    // A importação substitui os dados atuais, então pede confirmação se já houver algo
    if (movimentacoes.length > 0) {
        const atuais = movimentacoes.length === 1
            ? "a movimentação atual"
            : `as ${movimentacoes.length} movimentações atuais`;
        const confirmou = confirm(
            `O arquivo tem ${textoImportadas}.\n` +
            `${qtdImportadas === 1 ? "Ela vai" : "Elas vão"} substituir ${atuais}. Continuar?`
        );
        if (!confirmou) return;
    }

    if (!Armazenamento.salvarMovimentacoes(importadas)) {
        mostrarAviso("Não foi possível salvar os dados importados.", "erro");
        return;
    }

    movimentacoes = importadas;
    if (idEmEdicao !== null) {
        sairModoEdicao();
    }
    atualizarTela();

    let mensagem = `${textoImportadas} ${qtdImportadas === 1 ? "importada" : "importadas"}.`;
    if (resultado.ignoradas > 0) {
        mensagem += ` ${resultado.ignoradas} inválida(s) ignorada(s).`;
    }
    mostrarAviso(mensagem);
}

// ---------- Aviso rápido ----------

// Mostra uma mensagem por alguns segundos no canto da tela
function mostrarAviso(mensagem, tipo = "sucesso") {
    avisoEl.textContent = mensagem;
    avisoEl.classList.toggle("erro", tipo === "erro");
    avisoEl.hidden = false;

    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => {
        avisoEl.hidden = true;
    }, DURACAO_AVISO_MS);
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
