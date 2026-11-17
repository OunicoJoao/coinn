/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18),
 * ver histórico (#19), editar e excluir (#20), categorias e subcategorias, filtros e limpar tudo,
 * movimentações futuras (saldo atual x previsto), visão Geral / Mensal (com filtro De/Até
 * no histórico) e seleção de várias movimentações para excluir de uma vez.
 * Gerenciador de categorias (botões "Selecionar": escolher, criar, renomear e excluir),
 * "Repetir todo mês" (movimentações recorrentes), filtro "Quando" (só futuras) na visão geral
 * e histórico de 30 em 30 ("Carregar mais").
 * Aba Relatórios: números do período, gráficos de entradas, saídas e saldo por mês,
 * categorias, destaques, tabela mês a mês, planilha CSV e impressão.
 * Na barra do topo: mostrar/ocultar valores, modo claro/noturno e exportar/importar os dados (#21):
 * exportar um mês, vários meses, um ano ou tudo (e, se quiser, remover esse período da Coinn);
 * importar incorporando aos dados atuais (com tratamento de conflitos) ou substituindo.
 *
 * Este arquivo só cuida da tela (ler o formulário, desenhar a lista, reagir a cliques).
 * - As regras de negócio (validar, calcular, filtrar, ordenar) ficam em regras.js.
 * - Os cálculos dos relatórios ficam em relatorios.js; os gráficos, em graficos.js.
 * - O acesso aos dados fica em storage.js.
 */

/* global Regras, Relatorios, Graficos, Armazenamento */

// ---------- Constantes ----------

const { TIPO, LIMITES, FILTRO_TODOS, FILTRO_SEM, QUANDO, SITUACAO_MES, TIPO_PERIODO, MODO_IMPORTACAO } = Regras;

// O histórico mostra 30 movimentações por vez; "Carregar mais" traz as próximas 30
const TAMANHO_PAGINA = 30;

// Ícones pequenos (traços de um SVG 24x24)
const ICONE = Object.freeze({
    check: ["M5 12l5 5 9-10"],
    repetir: ["M17 2l4 4-4 4", "M3 11V9a3 3 0 0 1 3-3h15", "M7 22l-4-4 4-4", "M21 13v2a3 3 0 0 1-3 3H3"],
    seta: ["M12 5v14", "M6 13l6 6 6-6"]
});

// Visões do topo da página
const VISAO = Object.freeze({
    GERAL: "geral",   // todas as movimentações; saldo atual + previsto
    MENSAL: "mensal", // um mês por vez, escolhido no navegador de meses
    RELATORIOS: "relatorios" // gráficos e números de um período
});

// Nomes das opções de período (relatórios, exportar e importar)
const NOME_PERIODO = Object.freeze({
    [TIPO_PERIODO.MES]: "Mês",
    [TIPO_PERIODO.MESES]: "Vários meses",
    [TIPO_PERIODO.ANO]: "Ano",
    [TIPO_PERIODO.ULTIMOS_12]: "Últimos 12 meses",
    [TIPO_PERIODO.TUDO]: "Tudo"
});

// Quantas movimentações em conflito aparecem na lista do diálogo de importação
const MAX_CONFLITOS_MOSTRADOS = 5;

// Texto mostrado no lugar dos valores quando o "olho" está fechado
const VALOR_OCULTO = "R$ •••••";

// Cor da barra do navegador no celular, em cada tema (igual à barra do topo)
const COR_BARRA_NAVEGADOR = Object.freeze({
    claro: "#fcd97a",
    escuro: "#820AD1"
});

// Tempo que o aviso rápido fica na tela
const DURACAO_AVISO_MS = 3500;

// Formatos dos relatórios: valores curtos nos gráficos ("R$ 15 mil") e porcentagens ("42%")
const formatoCompacto = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1
});
const formatoSemCentavos = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0
});
const formatoPorcentagem = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

// ---------- Elementos da página ----------

const abasVisaoEl = document.querySelector(".visao-abas");
const navegadorMesEl = document.getElementById("navegador-mes");
const mesVisaoEl = document.getElementById("mes-visao");
const btnMesAnteriorEl = document.getElementById("btn-mes-anterior");
const btnMesProximoEl = document.getElementById("btn-mes-proximo");
const btnMesAtualEl = document.getElementById("btn-mes-atual");
const tituloSaldoEl = document.getElementById("titulo-saldo");
const saldoDetalheEl = document.getElementById("saldo-detalhe");
const tituloEntradasEl = document.getElementById("titulo-entradas");
const tituloSaidasEl = document.getElementById("titulo-saidas");
const filtroMesGrupoEl = document.getElementById("filtro-mes-grupo");
const avisoDataFuturaEl = document.getElementById("aviso-data-futura");
const filtroInicioGrupoEl = document.getElementById("filtro-inicio-grupo");
const filtroFimGrupoEl = document.getElementById("filtro-fim-grupo");
const periodoInicioEl = document.getElementById("filtro-data-inicio");
const periodoFimEl = document.getElementById("filtro-data-fim");
const periodoErroEl = document.getElementById("filtro-periodo-erro");
const barraSelecaoEl = document.getElementById("barra-selecao");
const selecaoResumoEl = document.getElementById("selecao-resumo");
const btnSelecionarTodasEl = document.getElementById("btn-selecionar-todas");
const btnCancelarSelecaoEl = document.getElementById("btn-cancelar-selecao");
const btnExcluirSelecionadasEl = document.getElementById("btn-excluir-selecionadas");
const saldoEl = document.getElementById("saldo");
const totalEntradasEl = document.getElementById("total-entradas");
const totalSaidasEl = document.getElementById("total-saidas");
const listaEl = document.getElementById("lista-movimentacoes");
const historicoVazioEl = document.getElementById("historico-vazio");
const totalFiltradoEl = document.getElementById("total-filtrado");
const btnLimparTudoEl = document.getElementById("btn-limpar-tudo");
const filtrosEl = document.getElementById("filtros");
const filtroTipoEl = document.getElementById("filtro-tipo");
const filtroQuandoEl = document.getElementById("filtro-quando");
const filtroQuandoGrupoEl = document.getElementById("filtro-quando-grupo");
const filtroMesEl = document.getElementById("filtro-mes");
const filtroCategoriaEl = document.getElementById("filtro-categoria");
const filtroSubcategoriaEl = document.getElementById("filtro-subcategoria");
const btnLimparFiltrosEl = document.getElementById("btn-limpar-filtros");
const formContainerEl = document.getElementById("form-container");
const tituloFormEl = document.getElementById("titulo-form");
const formEl = document.getElementById("form-movimentacao");
const descricaoEl = document.getElementById("descricao");
const contadorEl = document.getElementById("contador-descricao");
const valorEl = document.getElementById("valor");
const dataEl = document.getElementById("data");
const categoriaEl = document.getElementById("categoria");
const subcategoriaEl = document.getElementById("subcategoria");

// Gerenciador de categorias (botões "Selecionar" do formulário)
const btnCategoriaEl = document.getElementById("btn-categoria");
const btnSubcategoriaEl = document.getElementById("btn-subcategoria");
const textoCategoriaEl = document.getElementById("texto-categoria");
const textoSubcategoriaEl = document.getElementById("texto-subcategoria");
const gerenciadorEl = document.getElementById("gerenciador-categorias");
const gerenciadorTituloEl = document.getElementById("gerenciador-titulo");
const gerenciadorSubtituloEl = document.getElementById("gerenciador-subtitulo");
const btnFecharGerenciadorEl = document.getElementById("btn-fechar-gerenciador");
const novaCategoriaEl = document.getElementById("nova-categoria");
const btnCriarCategoriaEl = document.getElementById("btn-criar-categoria");
const gerenciadorErroEl = document.getElementById("gerenciador-erro");
const gerenciadorListaEl = document.getElementById("gerenciador-lista");
const gerenciadorVazioEl = document.getElementById("gerenciador-vazio");

// Recorrência ("Repetir todo mês")
const infoSerieEl = document.getElementById("info-serie");
const opcaoRepetirGrupoEl = document.getElementById("opcao-repetir-grupo");
const repetirEl = document.getElementById("repetir");
const recorrenciaOpcoesEl = document.getElementById("recorrencia-opcoes");
const repeticoesEl = document.getElementById("repeticoes");
const previaRecorrenciaEl = document.getElementById("previa-recorrencia");
const dialogoSerieEl = document.getElementById("dialogo-serie");
const formSerieEl = document.getElementById("form-serie");
const tituloSerieEl = document.getElementById("titulo-serie");
const serieTextoEl = document.getElementById("serie-texto");
const serieUmaTextoEl = document.getElementById("serie-uma-texto");
const serieTodasTextoEl = document.getElementById("serie-todas-texto");
const btnConfirmarSerieEl = document.getElementById("btn-confirmar-serie");
const erroEl = document.getElementById("mensagem-erro");
const btnRegistrarEl = document.getElementById("btn-registrar");
const btnCancelarEdicaoEl = document.getElementById("btn-cancelar-edicao");
const btnVisibilidadeEl = document.getElementById("btn-visibilidade");
const btnTemaEl = document.getElementById("btn-tema");
const metaCorNavegadorEl = document.querySelector('meta[name="theme-color"]');
const btnDadosEl = document.getElementById("btn-dados");
const menuDadosEl = document.getElementById("menu-dados");
const btnExportarEl = document.getElementById("btn-exportar");
const btnImportarEl = document.getElementById("btn-importar");
const arquivoImportarEl = document.getElementById("arquivo-importar");
const avisoEl = document.getElementById("aviso");
const painelSaldoEl = document.getElementById("painel-saldo");
const painelPrincipalEl = document.getElementById("painel-principal");

// Relatórios
const relatorioEl = document.getElementById("relatorio");
const relatorioSubtituloEl = document.getElementById("relatorio-subtitulo");
const relatorioPeriodoEl = document.getElementById("relatorio-periodo");
const relatorioVazioEl = document.getElementById("relatorio-vazio");
const relatorioConteudoEl = document.getElementById("relatorio-conteudo");
const relatorioCartoesEl = document.getElementById("relatorio-cartoes");
const graficoEntradasEl = document.getElementById("grafico-entradas");
const graficoSaidasEl = document.getElementById("grafico-saidas");
const graficoSaldoEl = document.getElementById("grafico-saldo");
const relatorioInformacoesEl = document.getElementById("relatorio-informacoes");
const relatorioDestaquesEl = document.getElementById("relatorio-destaques");
const categoriasSaidasEl = document.getElementById("relatorio-categorias-saidas");
const categoriasSaidasVazioEl = document.getElementById("relatorio-categorias-saidas-vazio");
const categoriasEntradasEl = document.getElementById("relatorio-categorias-entradas");
const categoriasEntradasVazioEl = document.getElementById("relatorio-categorias-entradas-vazio");
const relatorioMaioresEl = document.getElementById("relatorio-maiores");
const relatorioMaioresVazioEl = document.getElementById("relatorio-maiores-vazio");
const tabelaCorpoEl = document.getElementById("relatorio-tabela-corpo");
const tabelaRodapeEl = document.getElementById("relatorio-tabela-rodape");
const btnRelatorioCsvEl = document.getElementById("btn-relatorio-csv");
const btnRelatorioImprimirEl = document.getElementById("btn-relatorio-imprimir");

// Diálogo de exportar
const dialogoExportarEl = document.getElementById("dialogo-exportar");
const formExportarEl = document.getElementById("form-exportar");
const exportarPeriodoEl = document.getElementById("exportar-periodo");
const exportarPreviaEl = document.getElementById("exportar-previa");
const exportarRemoverEl = document.getElementById("exportar-remover");
const exportarEspacoEl = document.getElementById("exportar-espaco");
const exportarRemoverOpcoesEl = document.getElementById("exportar-remover-opcoes");
const exportarAjusteEl = document.getElementById("exportar-ajuste");
const exportarAjusteTextoEl = document.getElementById("exportar-ajuste-texto");
const exportarAlertaEl = document.getElementById("exportar-alerta");
const exportarErroEl = document.getElementById("exportar-erro");
const btnConfirmarExportarEl = document.getElementById("btn-confirmar-exportar");

// Diálogo de importar
const dialogoImportarEl = document.getElementById("dialogo-importar");
const formImportarEl = document.getElementById("form-importar");
const importarArquivoEl = document.getElementById("importar-arquivo");
const importarPeriodoEl = document.getElementById("importar-periodo");
const importarModoPeriodoTextoEl = document.getElementById("importar-modo-periodo-texto");
const importarModoTudoTextoEl = document.getElementById("importar-modo-tudo-texto");
const importarPreviaEl = document.getElementById("importar-previa");
const importarConflitosEl = document.getElementById("importar-conflitos");
const importarConflitosTextoEl = document.getElementById("importar-conflitos-texto");
const importarConflitosListaEl = document.getElementById("importar-conflitos-lista");
const importarAlertaEl = document.getElementById("importar-alerta");
const importarErroEl = document.getElementById("importar-erro");
const btnConfirmarImportarEl = document.getElementById("btn-confirmar-importar");

// ---------- Estado ----------

// normalizarMovimentacao garante os campos de categoria em dados salvos antes deles existirem
let movimentacoes = Armazenamento.carregarMovimentacoes().map(Regras.normalizarMovimentacao);

// Categorias cadastradas no gerenciador: [{ id, nome, subcategorias: [{ id, nome }] }].
// Quem já tinha movimentações com categoria ganha o cadastro delas na primeira vez.
let categorias = Regras.lerCategorias(Armazenamento.carregarCategorias());
sincronizarCategorias();

// Gerenciador de categorias aberto: "categoria", "subcategoria" ou null (fechado),
// e o id do item que está sendo renomeado (ou null)
let modoGerenciador = null;
let idRenomeando = null;

// id da movimentação sendo editada; null quando o formulário está criando uma nova
let idEmEdicao = null;

// Visão escolhida nas abas e o mês mostrado na visão mensal ("AAAA-MM")
let visao = VISAO.GERAL;
let mesVisao = mesDeHoje();

// Filtro De/Até do histórico na visão mensal: { inicio, fim } ("AAAA-MM-DD") ou null.
// Muda só a lista e o resumo do histórico; o card de saldo continua mostrando o mês.
let periodo = null;

// ids das movimentações marcadas no histórico, e ids das que estão aparecendo na lista
const selecionadas = new Set();
let idsVisiveis = [];

// Histórico de 30 em 30: quantas aparecem agora e todas as que passam nos filtros
let limiteLista = TAMANHO_PAGINA;
let movimentacoesFiltradas = [];

// true = valores aparecem; false = aparecem como "R$ •••••"
let valoresVisiveis = Armazenamento.carregarValoresVisiveis();

// "claro" ou "escuro" (o index.html já aplicou o tema salvo antes de a página aparecer)
let temaAtual = Armazenamento.carregarTema();

// Guarda o timer do aviso para poder reiniciá-lo
let timerAviso = null;

// Último relatório desenhado (usado para baixar o CSV)
let relatorioAtual = null;

// Arquivo aberto no diálogo de importar: { nome, lista, ignoradas, periodoDoArquivo }
let importacao = null;

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
novaCategoriaEl.maxLength = LIMITES.CATEGORIA_MAX;
repeticoesEl.min = LIMITES.REPETICOES_MIN;
repeticoesEl.max = LIMITES.REPETICOES_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hoje();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);
dataEl.addEventListener("input", () => {
    atualizarAvisoDataFutura();
    atualizarPreviaRecorrencia();
});
valorEl.addEventListener("input", atualizarPreviaRecorrencia);
repetirEl.addEventListener("change", atualizarOpcoesRecorrencia);
repeticoesEl.addEventListener("input", atualizarPreviaRecorrencia);
btnCancelarEdicaoEl.addEventListener("click", cancelarEdicao);
btnLimparTudoEl.addEventListener("click", limparTudo);

// Filtros: trocar qualquer um volta a lista para as primeiras 30
filtroTipoEl.addEventListener("change", atualizarHistoricoDoInicio);
filtroQuandoEl.addEventListener("change", atualizarHistoricoDoInicio);
filtroMesEl.addEventListener("change", atualizarHistoricoDoInicio);
filtroCategoriaEl.addEventListener("change", () => {
    atualizarOpcoesSubcategoria(); // a lista de subcategorias depende da categoria
    atualizarHistoricoDoInicio();
});
filtroSubcategoriaEl.addEventListener("change", atualizarHistoricoDoInicio);
btnLimparFiltrosEl.addEventListener("click", limparFiltros);

// Gerenciador de categorias
btnCategoriaEl.addEventListener("click", () => alternarGerenciador("categoria"));
btnSubcategoriaEl.addEventListener("click", () => alternarGerenciador("subcategoria"));
btnFecharGerenciadorEl.addEventListener("click", () => fecharGerenciador(true));
btnCriarCategoriaEl.addEventListener("click", criarCategoria);
novaCategoriaEl.addEventListener("keydown", (evento) => {
    if (evento.key === "Enter") {
        evento.preventDefault(); // não registra a movimentação
        criarCategoria();
    }
});
novaCategoriaEl.addEventListener("input", () => mostrarErroGerenciador(""));
gerenciadorListaEl.addEventListener("click", tratarCliqueNoGerenciador);
gerenciadorListaEl.addEventListener("keydown", tratarTeclaNoGerenciador);
document.addEventListener("click", fecharGerenciadorAoClicarFora);
document.addEventListener("keydown", fecharGerenciadorComEsc);

// Visão Geral / Mensal e navegação entre meses
abasVisaoEl.addEventListener("click", trocarVisao);
btnMesAnteriorEl.addEventListener("click", () => irParaMes(Regras.deslocarMes(mesVisao, -1)));
btnMesProximoEl.addEventListener("click", () => irParaMes(Regras.deslocarMes(mesVisao, 1)));
btnMesAtualEl.addEventListener("click", () => irParaMes(mesDeHoje()));

// Filtro De/Até: preencher uma data só já mostra aquele dia; depois dá para ajustar a outra
periodoInicioEl.addEventListener("change", () => {
    if (!periodoFimEl.value) periodoFimEl.value = periodoInicioEl.value;
    aplicarPeriodo();
});
periodoFimEl.addEventListener("change", () => {
    if (!periodoInicioEl.value) periodoInicioEl.value = periodoFimEl.value;
    aplicarPeriodo();
});

// Seleção de várias movimentações
listaEl.addEventListener("change", tratarSelecaoNaLista);
btnSelecionarTodasEl.addEventListener("click", selecionarTodas);
btnCancelarSelecaoEl.addEventListener("click", cancelarSelecao);
btnExcluirSelecionadasEl.addEventListener("click", excluirSelecionadas);

// Um único listener na lista cuida dos botões de todos os itens (delegação de eventos),
// assim não é preciso usar onclick no HTML gerado
listaEl.addEventListener("click", tratarCliqueNaLista);

// Barra do topo
btnVisibilidadeEl.addEventListener("click", alternarVisibilidade);
btnTemaEl.addEventListener("click", alternarTema);
btnDadosEl.addEventListener("click", alternarMenuDados);
btnExportarEl.addEventListener("click", abrirExportar);
btnImportarEl.addEventListener("click", () => arquivoImportarEl.click());
arquivoImportarEl.addEventListener("change", abrirImportar);
document.addEventListener("click", fecharMenuAoClicarFora);
document.addEventListener("keydown", fecharMenuComEsc);
document.addEventListener("keydown", cancelarSelecaoComEsc);

// Seletores de período: relatórios, exportar e importar
const seletorRelatorio = criarSeletorPeriodo(relatorioPeriodoEl, "relatorio",
    [TIPO_PERIODO.MES, TIPO_PERIODO.MESES, TIPO_PERIODO.ANO, TIPO_PERIODO.ULTIMOS_12, TIPO_PERIODO.TUDO],
    atualizarRelatorio);
const seletorExportar = criarSeletorPeriodo(exportarPeriodoEl, "exportar",
    [TIPO_PERIODO.TUDO, TIPO_PERIODO.MES, TIPO_PERIODO.MESES, TIPO_PERIODO.ANO],
    atualizarPreviaExportar);
const seletorImportar = criarSeletorPeriodo(importarPeriodoEl, "importar",
    [TIPO_PERIODO.TUDO, TIPO_PERIODO.MES, TIPO_PERIODO.MESES, TIPO_PERIODO.ANO],
    atualizarPreviaImportar);
seletorRelatorio.definirEscolha({ tipo: TIPO_PERIODO.ANO, ano: hoje().slice(0, 4) });

// Relatórios
btnRelatorioCsvEl.addEventListener("click", baixarRelatorioCSV);
btnRelatorioImprimirEl.addEventListener("click", () => window.print());

// Diálogos de exportar e importar
exportarRemoverEl.addEventListener("change", atualizarPreviaExportar);
exportarAjusteEl.addEventListener("change", atualizarPreviaExportar);
formExportarEl.addEventListener("submit", confirmarExportar);
formImportarEl.addEventListener("change", (evento) => {
    // Os seletores de período já avisam sozinhos; aqui só os rádios de modo e de conflito
    if (evento.target.name === "modo-importar" || evento.target.name === "conflito-importar") {
        atualizarPreviaImportar();
    }
});
formImportarEl.addEventListener("submit", confirmarImportar);
dialogoImportarEl.addEventListener("close", () => {
    importacao = null;
});
document.querySelectorAll("dialog [data-fechar]").forEach((botao) => {
    botao.addEventListener("click", () => botao.closest("dialog").close());
});

aplicarVisibilidade();
aplicarTema();
atualizarContador();
atualizarSeletoresCategoria();
atualizarOpcoesRecorrencia();
atualizarTela();

// ---------- #17 Registrar movimentação (e salvar edição) ----------

async function registrarMovimentacao(evento) {
    evento.preventDefault(); // evita recarregar a página

    const criandoSerie = idEmEdicao === null && repetirEl.checked;
    const repeticoes = criandoSerie ? Number(repeticoesEl.value) : 1;
    const erro = Regras.validarMovimentacao(lerFormulario())
        || (criandoSerie ? Regras.validarRepeticoes(repeticoes) : null);
    if (erro) {
        mostrarErro(erro);
        return;
    }

    // Se já existe "Alimentação" e a categoria veio como "alimentação", usa a grafia que já existe
    const dados = Regras.aplicarGrafiaExistente(movimentacoes, lerFormulario());

    if (idEmEdicao !== null) {
        await salvarEdicao(dados);
        return;
    }

    const novas = Regras.criarMovimentacoes(dados, novoId(), repeticoes);
    if (!salvar(Regras.adicionarMovimentacoes(movimentacoes, novas))) {
        mostrarErro("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    sairModoEdicao();
    atualizarTela();
    if (repeticoes > 1) {
        mostrarAviso(`${repeticoes} movimentações registradas, uma por mês, até ${Regras.formatarData(novas[novas.length - 1].data)}.`);
    }
}

// Salva a edição. Numa movimentação recorrente com parcelas seguintes, pergunta se a
// mudança vale só para esta parcela ou para esta e as próximas.
async function salvarEdicao(dados) {
    const id = idEmEdicao;
    const atual = movimentacoes.find((mov) => mov.id === id);
    if (!atual) {
        sairModoEdicao();
        return;
    }

    let escopo = "uma";
    const proximas = Regras.proximasDaSerie(movimentacoes, id);
    if (proximas.length > 0) {
        escopo = await perguntarEscopoDaSerie("editar", atual, proximas);
        if (!escopo) return;
    }

    const quando = new Date().toISOString();
    const novaLista = escopo === "serie"
        ? Regras.editarSerie(movimentacoes, id, dados, quando)
        : Regras.editarMovimentacao(movimentacoes, id, dados, quando);
    if (!salvar(novaLista)) {
        mostrarErro("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    sairModoEdicao();
    atualizarTela();
    if (escopo === "serie") {
        mostrarAviso(`Alterações salvas nesta e em mais ${proximas.length} ${proximas.length === 1 ? "parcela" : "parcelas"}.`);
    }
}

// Um id que ainda não existe; numa série, os ids seguintes também ficam livres
function novoId() {
    const maior = movimentacoes.reduce((maximo, mov) => Math.max(maximo, mov.id), 0);
    return Math.max(Date.now(), maior + 1);
}

function lerFormulario() {
    const tipoMarcado = formEl.querySelector('input[name="tipo"]:checked');
    return {
        tipo: tipoMarcado ? tipoMarcado.value : "",
        valor: Number(valorEl.value),
        data: dataEl.value,
        descricao: descricaoEl.value.trim(),
        categoria: categoriaEl.value.trim(),
        subcategoria: subcategoriaEl.value.trim()
    };
}

function limparFormulario() {
    formEl.reset();
    // Campos escondidos não voltam com o reset(): limpa a categoria escolhida à mão
    categoriaEl.value = "";
    subcategoriaEl.value = "";
    dataEl.value = hoje();
    repeticoesEl.value = "12";
    esconderErro();
    atualizarContador();
    atualizarSeletoresCategoria();
    atualizarOpcoesRecorrencia();
    atualizarAvisoDataFutura();
    descricaoEl.focus();
}

// ---------- Recorrência ("Repetir todo mês") ----------

// A opção só aparece ao registrar uma movimentação nova
function atualizarOpcoesRecorrencia() {
    const editando = idEmEdicao !== null;
    opcaoRepetirGrupoEl.hidden = editando;
    recorrenciaOpcoesEl.hidden = editando || !repetirEl.checked;
    atualizarPreviaRecorrencia();
}

// "12 movimentações de R$ 100,00, todo dia 10" / "De 10/11/2026 a 10/10/2027 · Total: R$ 1.200,00"
function atualizarPreviaRecorrencia() {
    if (recorrenciaOpcoesEl.hidden) return;

    const repeticoes = Number(repeticoesEl.value);
    const valor = Number(valorEl.value);
    if (!Regras.dataValida(dataEl.value) || Regras.validarRepeticoes(repeticoes)) {
        previaRecorrenciaEl.replaceChildren(criarLinhaDeTexto([
            `De ${LIMITES.REPETICOES_MIN} a ${LIMITES.REPETICOES_MAX} vezes, contando a primeira.`
        ]));
        return;
    }

    const resumo = Regras.resumirRecorrencia(dataEl.value, valor > 0 ? valor : 0, repeticoes);
    const linhas = [
        criarLinhaDeTexto([
            valor > 0
                ? `${repeticoes} movimentações de ${exibirValor(Regras.arredondarCentavos(valor))}`
                : `${repeticoes} movimentações`,
            `todo dia ${resumo.dia}`
        ]),
        criarLinhaDeTexto([
            `De ${Regras.formatarData(resumo.primeira)} a ${Regras.formatarData(resumo.ultima)}`,
            ...(valor > 0 ? [`Total: ${exibirValor(resumo.total)}`] : [])
        ])
    ];
    if (resumo.ajustaFimDoMes) {
        linhas.push(criarLinhaDeTexto([`Nos meses sem dia ${resumo.dia}, fica no último dia do mês.`]));
    }
    previaRecorrenciaEl.replaceChildren(...linhas);
}

// Abre o diálogo e espera a resposta: o que "lerResposta" devolver ao confirmar,
// ou null se a pessoa cancelar (botão Cancelar, Esc)
function esperarResposta(dialogo, form, lerResposta) {
    return new Promise((resolver) => {
        let resposta = null;
        const aoConfirmar = (evento) => {
            evento.preventDefault();
            resposta = lerResposta();
            dialogo.close();
        };
        form.addEventListener("submit", aoConfirmar);
        dialogo.addEventListener("close", () => {
            form.removeEventListener("submit", aoConfirmar);
            resolver(resposta);
        }, { once: true });
        dialogo.showModal();
    });
}

// acao: "editar" ou "excluir". Devolve "uma", "serie" ou null (cancelou).
function perguntarEscopoDaSerie(acao, mov, proximas) {
    const { parcela, total } = mov.recorrencia;
    const ultima = proximas.reduce((maior, item) => (item.data > maior.data ? item : maior), proximas[0]);
    const excluir = acao === "excluir";

    tituloSerieEl.textContent = excluir ? "Excluir movimentação recorrente" : "Salvar movimentação recorrente";
    serieTextoEl.textContent = `"${mov.descricao}" é a parcela ${parcela} de ${total}. `
        + `${excluir ? "O que excluir?" : "Onde aplicar as alterações?"}`;
    serieUmaTextoEl.textContent = `${excluir ? "Exclui" : "Muda"} só a de ${Regras.formatarData(mov.data)}.`;
    serieTodasTextoEl.textContent = `${excluir ? "Exclui" : "Muda"} esta e mais `
        + `${proximas.length} ${proximas.length === 1 ? "parcela" : "parcelas"}, até ${Regras.formatarData(ultima.data)}. `
        + "As anteriores não mudam.";
    btnConfirmarSerieEl.textContent = excluir ? "Excluir" : "Salvar";
    btnConfirmarSerieEl.classList.toggle("perigo", excluir);
    formSerieEl.querySelector('input[name="escopo-serie"][value="uma"]').checked = true;

    return esperarResposta(dialogoSerieEl, formSerieEl,
        () => formSerieEl.querySelector('input[name="escopo-serie"]:checked').value);
}

// Avisa, embaixo do campo de data, quando a data escolhida é futura
function atualizarAvisoDataFutura() {
    avisoDataFuturaEl.hidden = !(Regras.dataValida(dataEl.value) && dataEl.value > hoje());
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
    categoriaEl.value = mov.categoria;
    subcategoriaEl.value = mov.subcategoria;
    repetirEl.checked = false;

    if (mov.recorrencia) {
        infoSerieEl.replaceChildren(
            criarIcone(ICONE.repetir),
            `Parcela ${mov.recorrencia.parcela} de ${mov.recorrencia.total} de uma movimentação recorrente`
        );
    }
    infoSerieEl.hidden = !mov.recorrencia;

    tituloFormEl.textContent = "Editar movimentação";
    btnRegistrarEl.textContent = "Salvar alterações";
    btnCancelarEdicaoEl.hidden = false;
    formContainerEl.classList.add("editando");

    esconderErro();
    atualizarContador();
    fecharGerenciador();
    atualizarSeletoresCategoria();
    atualizarOpcoesRecorrencia();
    atualizarAvisoDataFutura();
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
    infoSerieEl.hidden = true;
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

async function excluirMovimentacao(id) {
    const mov = movimentacoes.find((m) => m.id === id);
    if (!mov) return;

    // Recorrente com parcelas seguintes: só esta ou esta e as próximas?
    const proximas = Regras.proximasDaSerie(movimentacoes, id);
    let escopo = "uma";
    if (proximas.length > 0) {
        escopo = await perguntarEscopoDaSerie("excluir", mov, proximas);
        if (!escopo) return;
    } else {
        const confirmou = confirm(`Excluir "${mov.descricao}" (${Regras.formatarData(mov.data)})?`);
        if (!confirmou) return;
    }

    const removidas = new Set(escopo === "serie" ? [id, ...proximas.map((item) => item.id)] : [id]);
    const novaLista = escopo === "serie"
        ? Regras.excluirSerie(movimentacoes, id)
        : Regras.excluirMovimentacao(movimentacoes, id);

    if (!salvar(novaLista)) {
        mostrarErro("Não foi possível excluir. Verifique se o navegador permite armazenamento local.");
        return;
    }

    // Se a movimentação excluída estava aberta no formulário, sai da edição
    if (idEmEdicao !== null && removidas.has(idEmEdicao)) {
        sairModoEdicao();
    }
    removidas.forEach((removida) => selecionadas.delete(removida));

    atualizarTela();
    if (removidas.size > 1) mostrarAviso(`${removidas.size} parcelas excluídas.`);
}

// ---------- Gerenciador de categorias ----------

// Cadastra as categorias usadas nas movimentações que ainda não estão no gerenciador
// (dados de antes do gerenciador, importação). Grava só se algo mudou.
function sincronizarCategorias() {
    const resultado = Regras.sincronizarCategorias(categorias, movimentacoes);
    if (!resultado.mudou) return;
    categorias = resultado.categorias;
    Armazenamento.salvarCategorias(categorias);
}

// Botões "Selecionar" do formulário: mostram o que está escolhido
function atualizarSeletoresCategoria() {
    const categoria = categoriaEl.value;
    const subcategoria = subcategoriaEl.value;

    textoCategoriaEl.textContent = categoria || "Selecionar";
    btnCategoriaEl.classList.toggle("vazio", !categoria);
    textoSubcategoriaEl.textContent = subcategoria || "Selecionar";
    btnSubcategoriaEl.classList.toggle("vazio", !subcategoria);

    // Sem categoria não há subcategoria
    btnSubcategoriaEl.disabled = !categoria;
    btnSubcategoriaEl.title = categoria ? "" : "Escolha a categoria primeiro";
    if (!categoria && modoGerenciador === "subcategoria") fecharGerenciador();

    if (modoGerenciador) desenharGerenciador();
}

// A categoria escolhida no formulário, no cadastro (ou undefined)
function categoriaDoFormulario() {
    return categorias.find((item) => Regras.mesmoNome(item.nome, categoriaEl.value));
}

function alternarGerenciador(modo) {
    if (modoGerenciador === modo) {
        fecharGerenciador(true);
        return;
    }
    abrirGerenciador(modo);
}

function abrirGerenciador(modo) {
    fecharMenuDados();
    modoGerenciador = modo;
    idRenomeando = null;
    novaCategoriaEl.value = "";
    mostrarErroGerenciador("");

    const subcategoria = modo === "subcategoria";
    gerenciadorEl.classList.toggle("a-direita", subcategoria);
    btnCategoriaEl.setAttribute("aria-expanded", String(!subcategoria));
    btnSubcategoriaEl.setAttribute("aria-expanded", String(subcategoria));
    gerenciadorEl.hidden = false;
    desenharGerenciador();
    novaCategoriaEl.focus();
}

// devolverFoco: volta o foco para o botão que abriu o painel (fechar pelo × ou pelo Esc)
function fecharGerenciador(devolverFoco = false) {
    if (!modoGerenciador) return;
    const botao = modoGerenciador === "subcategoria" ? btnSubcategoriaEl : btnCategoriaEl;
    modoGerenciador = null;
    idRenomeando = null;
    gerenciadorEl.hidden = true;
    btnCategoriaEl.setAttribute("aria-expanded", "false");
    btnSubcategoriaEl.setAttribute("aria-expanded", "false");
    if (devolverFoco) botao.focus();
}

function fecharGerenciadorAoClicarFora(evento) {
    if (!modoGerenciador) return;
    // Cliques no próprio painel ou nos botões que o abrem não fecham
    if (evento.target.closest("#gerenciador-categorias, #btn-categoria, #btn-subcategoria, dialog")) return;
    // Um item que acabou de ser redesenhado não está mais na página: também não fecha
    if (!evento.target.isConnected) return;
    fecharGerenciador();
}

function fecharGerenciadorComEsc(evento) {
    if (evento.key !== "Escape" || !modoGerenciador || algumDialogoAberto()) return;
    if (idRenomeando !== null) return; // o Esc do campo de renomear só cancela o renomear
    fecharGerenciador(true);
}

function mostrarErroGerenciador(mensagem) {
    gerenciadorErroEl.textContent = mensagem || "";
    gerenciadorErroEl.hidden = !mensagem;
}

// Itens do nível aberto: as categorias, ou as subcategorias da categoria escolhida
function itensDoGerenciador() {
    if (modoGerenciador === "categoria") return categorias;
    return categoriaDoFormulario()?.subcategorias || [];
}

function desenharGerenciador() {
    const subcategoria = modoGerenciador === "subcategoria";
    const categoria = categoriaDoFormulario();
    const itens = itensDoGerenciador();
    const escolhido = subcategoria ? subcategoriaEl.value : categoriaEl.value;

    gerenciadorTituloEl.textContent = subcategoria ? "Subcategorias" : "Categorias";
    gerenciadorSubtituloEl.textContent = subcategoria
        ? `de ${categoriaEl.value}`
        : "Escolha, crie, renomeie (✎) ou exclua (×)";
    novaCategoriaEl.placeholder = subcategoria ? "Nova subcategoria" : "Nova categoria";
    novaCategoriaEl.setAttribute("aria-label", subcategoria ? "Nome da nova subcategoria" : "Nome da nova categoria");

    const linhas = [criarItemNenhuma(subcategoria, !escolhido)];
    itens.forEach((item) => {
        linhas.push(item.id === idRenomeando
            ? criarItemRenomeando(item)
            : criarItemGerenciador(item, subcategoria ? categoria.nome : null, Regras.mesmoNome(item.nome, escolhido)));
    });
    gerenciadorListaEl.replaceChildren(...linhas);

    gerenciadorVazioEl.hidden = itens.length > 0;
    gerenciadorVazioEl.textContent = subcategoria
        ? "Nenhuma subcategoria nesta categoria. Crie a primeira acima."
        : "Nenhuma categoria ainda. Crie a primeira acima.";
}

// Primeira linha: "Sem categoria" / "Sem subcategoria"
function criarItemNenhuma(subcategoria, escolhido) {
    const li = document.createElement("li");
    li.classList.add("gerenciador-item", "nenhuma");
    li.classList.toggle("escolhido", escolhido);
    const botao = criarBotaoEscolher(subcategoria ? "Sem subcategoria" : "Sem categoria", "");
    botao.dataset.id = "";
    li.append(botao);
    return li;
}

function criarBotaoEscolher(nome, uso) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.classList.add("gerenciador-escolher");
    botao.dataset.acao = "escolher";
    const texto = document.createElement("span");
    texto.classList.add("gerenciador-nome");
    texto.textContent = nome;
    botao.append(criarIcone(ICONE.check), texto);
    if (uso) {
        const contagem = document.createElement("small");
        contagem.classList.add("gerenciador-uso");
        contagem.textContent = uso;
        botao.append(contagem);
    }
    return botao;
}

// Linha de uma categoria: escolher (o nome), renomear (✎) e excluir (×)
function criarItemGerenciador(item, nomeCategoria, escolhido) {
    const usos = nomeCategoria === null
        ? Regras.contarUsoCategoria(movimentacoes, item.nome)
        : Regras.contarUsoCategoria(movimentacoes, nomeCategoria, item.nome);

    const li = document.createElement("li");
    li.classList.add("gerenciador-item");
    li.classList.toggle("escolhido", escolhido);

    const escolher = criarBotaoEscolher(item.nome, usos ? textoQuantidade(usos) : "");
    escolher.dataset.id = item.id;
    escolher.setAttribute("aria-pressed", String(escolhido));
    li.append(
        escolher,
        criarBotaoAcao("renomear", "✎", `Renomear ${item.nome}`, item.id),
        criarBotaoAcao("excluir", "×", `Excluir ${item.nome}`, item.id)
    );
    li.querySelector('[data-acao="renomear"]').classList.add("btn-editar");
    return li;
}

// Linha em modo de renomear: campo com o nome, salvar (✓) e cancelar (↺)
function criarItemRenomeando(item) {
    const li = document.createElement("li");
    li.classList.add("gerenciador-item", "renomeando");

    const campo = document.createElement("input");
    campo.type = "text";
    campo.value = item.nome;
    campo.maxLength = LIMITES.CATEGORIA_MAX;
    campo.autocomplete = "off";
    campo.classList.add("gerenciador-renomear");
    campo.dataset.id = item.id;
    campo.setAttribute("aria-label", `Novo nome para ${item.nome}`);

    const salvarNome = criarBotaoAcao("salvar-nome", "✓", "Salvar o nome", item.id);
    salvarNome.classList.add("btn-salvar-nome");
    const cancelar = criarBotaoAcao("cancelar-nome", "↺", "Cancelar", item.id);
    cancelar.classList.add("btn-cancelar-nome");

    li.append(campo, salvarNome, cancelar);
    return li;
}

function tratarCliqueNoGerenciador(evento) {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;

    const id = botao.dataset.id === "" ? null : Number(botao.dataset.id);
    switch (botao.dataset.acao) {
    case "escolher":
        escolherCategoria(id);
        break;
    case "renomear":
        idRenomeando = id;
        mostrarErroGerenciador("");
        desenharGerenciador();
        gerenciadorListaEl.querySelector(".gerenciador-renomear")?.select();
        break;
    case "salvar-nome":
        salvarNovoNome(id);
        break;
    case "cancelar-nome":
        cancelarRenomear();
        break;
    case "excluir":
        excluirCategoria(id);
        break;
    }
}

// No campo de renomear: Enter salva o novo nome; Esc cancela
function tratarTeclaNoGerenciador(evento) {
    const campo = evento.target.closest(".gerenciador-renomear");
    if (!campo) return;
    if (evento.key === "Enter") {
        evento.preventDefault(); // não registra a movimentação
        salvarNovoNome(Number(campo.dataset.id));
    } else if (evento.key === "Escape") {
        evento.preventDefault();
        cancelarRenomear();
    }
}

function cancelarRenomear() {
    const id = idRenomeando;
    idRenomeando = null;
    mostrarErroGerenciador("");
    desenharGerenciador();
    gerenciadorListaEl.querySelector(`.gerenciador-escolher[data-id="${id}"]`)?.focus();
}

// Escolhe a categoria (ou "Sem categoria", id null) e fecha o painel
function escolherCategoria(id) {
    const item = id === null ? null : itensDoGerenciador().find((atual) => atual.id === id);
    if (modoGerenciador === "categoria") {
        const anterior = categoriaEl.value;
        categoriaEl.value = item ? item.nome : "";
        // Trocou a categoria: a subcategoria escolhida era da outra
        if (!Regras.mesmoNome(categoriaEl.value, anterior)) subcategoriaEl.value = "";
    } else {
        subcategoriaEl.value = item ? item.nome : "";
    }
    fecharGerenciador(true);
    atualizarSeletoresCategoria();
}

// Grava o resultado de criar, renomear ou excluir (categorias e, se mudaram, as movimentações)
function salvarGerenciador(novasCategorias, novaLista = null) {
    if (novaLista && novaLista !== movimentacoes && !salvar(novaLista)) return false;
    if (!Armazenamento.salvarCategorias(novasCategorias)) return false;
    categorias = novasCategorias;
    return true;
}

function criarCategoria() {
    const subcategoria = modoGerenciador === "subcategoria";
    const categoria = categoriaDoFormulario();
    if (subcategoria && !categoria) return;

    const resultado = Regras.criarCategoria(categorias, novaCategoriaEl.value, subcategoria ? categoria.id : null);
    if (resultado.erro) {
        mostrarErroGerenciador(resultado.erro);
        novaCategoriaEl.focus();
        return;
    }
    if (!salvarGerenciador(resultado.categorias)) {
        mostrarErroGerenciador("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    // A categoria criada já fica escolhida no formulário
    if (subcategoria) {
        subcategoriaEl.value = resultado.criada.nome;
    } else {
        categoriaEl.value = resultado.criada.nome;
        subcategoriaEl.value = "";
    }
    fecharGerenciador(true);
    atualizarTela();
    mostrarAviso(`${subcategoria ? "Subcategoria" : "Categoria"} "${resultado.criada.nome}" criada.`);
}

function salvarNovoNome(id) {
    const subcategoria = modoGerenciador === "subcategoria";
    const item = itensDoGerenciador().find((atual) => atual.id === id);
    const campo = gerenciadorListaEl.querySelector(".gerenciador-renomear");
    if (!item || !campo) return;

    if (campo.value.trim() === item.nome) {
        cancelarRenomear();
        return;
    }
    const resultado = Regras.renomearCategoria(categorias, movimentacoes, id, campo.value);
    if (resultado.erro) {
        mostrarErroGerenciador(resultado.erro);
        campo.focus();
        return;
    }
    if (!salvarGerenciador(resultado.categorias, resultado.lista)) {
        mostrarErroGerenciador("Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    // Se estava escolhida no formulário, o formulário acompanha o nome novo
    const campoDoFormulario = subcategoria ? subcategoriaEl : categoriaEl;
    if (Regras.mesmoNome(campoDoFormulario.value, item.nome)) campoDoFormulario.value = resultado.nome;

    idRenomeando = null;
    mostrarErroGerenciador("");
    atualizarTela();
    gerenciadorListaEl.querySelector(`.gerenciador-escolher[data-id="${id}"]`)?.focus();
    mostrarAviso(resultado.alteradas
        ? `"${item.nome}" agora é "${resultado.nome}" (${textoQuantidade(resultado.alteradas)} ${resultado.alteradas === 1 ? "atualizada" : "atualizadas"}).`
        : `"${item.nome}" agora é "${resultado.nome}".`);
}

function excluirCategoria(id) {
    const subcategoria = modoGerenciador === "subcategoria";
    const categoria = categoriaDoFormulario();
    const item = itensDoGerenciador().find((atual) => atual.id === id);
    if (!item) return;

    const usos = subcategoria
        ? Regras.contarUsoCategoria(movimentacoes, categoria.nome, item.nome)
        : Regras.contarUsoCategoria(movimentacoes, item.nome);
    const nivel = subcategoria ? "subcategoria" : "categoria";
    const partes = [`Excluir a ${nivel} "${item.nome}"?`];
    if (usos) {
        partes.push(`${usos === 1 ? "A movimentação que usa" : `As ${usos} movimentações que usam`} essa ${nivel} `
            + `${usos === 1 ? "fica" : "ficam"} sem ${nivel} (${usos === 1 ? "ela não é excluída" : "elas não são excluídas"}).`);
    } else {
        partes.push(`Nenhuma movimentação usa essa ${nivel}.`);
    }
    if (!subcategoria && item.subcategorias.length) {
        partes.push(`As subcategorias dela também são excluídas: ${item.subcategorias.map((sub) => sub.nome).join(", ")}.`);
    }
    if (!confirm(partes.join("\n\n"))) return;

    const resultado = Regras.excluirCategoria(categorias, movimentacoes, id);
    if (resultado.erro || !salvarGerenciador(resultado.categorias, resultado.lista)) {
        mostrarErroGerenciador(resultado.erro || "Não foi possível salvar. Verifique se o navegador permite armazenamento local.");
        return;
    }

    // Se estava escolhida no formulário, sai do formulário também
    if (subcategoria) {
        if (Regras.mesmoNome(subcategoriaEl.value, item.nome)) subcategoriaEl.value = "";
    } else if (Regras.mesmoNome(categoriaEl.value, item.nome)) {
        categoriaEl.value = "";
        subcategoriaEl.value = "";
    }

    idRenomeando = null;
    atualizarTela();
    novaCategoriaEl.focus();
    mostrarAviso(`${subcategoria ? "Subcategoria" : "Categoria"} "${item.nome}" excluída.`);
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
    resetarFiltros();
    atualizarTela();
}

// ---------- #18 Consultar saldo ----------

function atualizarResumo() {
    if (visao === VISAO.MENSAL) {
        atualizarResumoMensal();
    } else {
        atualizarResumoGeral();
    }
}

// Geral: saldo atual (só o que já aconteceu) e, se houver futuras, o saldo previsto
function atualizarResumoGeral() {
    const resumo = Regras.calcularResumoGeral(movimentacoes, hoje());

    tituloSaldoEl.textContent = "Seu saldo";
    tituloEntradasEl.textContent = "Entradas";
    tituloSaidasEl.textContent = "Saídas";
    mostrarSaldo(resumo.saldo, resumo.entradas, resumo.saidas);

    if (resumo.quantidadeFuturas > 0) {
        const futuras = resumo.quantidadeFuturas === 1
            ? "1 movimentação futura"
            : `${resumo.quantidadeFuturas} movimentações futuras`;
        mostrarDetalheSaldo([`Previsto: ${exibirValor(resumo.saldoPrevisto)}`, `com ${futuras}`]);
    } else {
        mostrarDetalheSaldo([]);
    }
}

// Mensal: entradas e saídas do mês, saldo no fim do mês (previsto se o mês não acabou)
function atualizarResumoMensal() {
    const resumo = Regras.calcularResumoMensal(movimentacoes, mesVisao, hoje());
    const nomeMes = Regras.formatarMes(mesVisao).split(" ")[0].toLowerCase();

    tituloSaldoEl.textContent = resumo.situacao === SITUACAO_MES.PASSADO
        ? `Saldo no fim de ${nomeMes}`
        : `Previsto para o fim de ${nomeMes}`;
    tituloEntradasEl.textContent = "Entradas do mês";
    tituloSaidasEl.textContent = "Saídas do mês";
    mostrarSaldo(resumo.saldoFinal, resumo.entradas, resumo.saidas);

    const sinal = resumo.resultado > 0 ? "+" : "";
    mostrarDetalheSaldo([
        `Início do mês: ${exibirValor(resumo.saldoInicial)}`,
        `Resultado do mês: ${valoresVisiveis ? sinal : ""}${exibirValor(resumo.resultado)}`
    ]);
}

function mostrarSaldo(saldo, entradas, saidas) {
    saldoEl.textContent = exibirValor(saldo);
    saldoEl.classList.toggle("negativo", saldo < 0 && valoresVisiveis);
    totalEntradasEl.textContent = exibirValor(entradas);
    totalSaidasEl.textContent = exibirValor(saidas);
}

function mostrarDetalheSaldo(partes) {
    saldoDetalheEl.replaceChildren(...(partes.length ? [criarLinhaDeTexto(partes)] : []));
    saldoDetalheEl.hidden = partes.length === 0;
}

// Uma linha de texto: cada parte é um <span> que não quebra no meio, separadas por " · "
function criarLinhaDeTexto(partes) {
    const linha = document.createElement("span");
    linha.classList.add("linha-texto");
    partes.forEach((texto, indice) => {
        if (indice > 0) linha.append(" · ");
        const parte = document.createElement("span");
        parte.classList.add("texto-parte");
        parte.textContent = texto;
        linha.append(parte);
    });
    return linha;
}

// ---------- Visão Geral / Mensal ----------

function trocarVisao(evento) {
    const aba = evento.target.closest("[data-visao]");
    if (!aba || aba.dataset.visao === visao) return;

    visao = aba.dataset.visao;
    if (visao === VISAO.MENSAL) {
        mesVisao = mesDeHoje(); // ao entrar na visão mensal, começa no mês de hoje
        limparPeriodo();
    }
    Graficos.esconderDica();
    reiniciarPaginacao();
    atualizarTela();
}

// ---------- Filtro De/Até do histórico (visão mensal) ----------

// Só o histórico muda: o card de saldo e o mês lá de cima continuam iguais
function aplicarPeriodo() {
    const inicio = periodoInicioEl.value;
    const fim = periodoFimEl.value;

    // Os dois campos vazios: o histórico volta a mostrar o mês
    if (!inicio && !fim) {
        limparPeriodo();
        atualizarHistoricoDoInicio();
        return;
    }

    const erro = Regras.validarPeriodo(inicio, fim);
    periodoErroEl.textContent = erro || "";
    periodoErroEl.hidden = !erro;
    if (erro) return; // mantém a lista como estava até o período ficar válido

    periodo = { inicio, fim };
    atualizarHistoricoDoInicio();
}

function limparPeriodo() {
    periodo = null;
    periodoInicioEl.value = "";
    periodoFimEl.value = "";
    periodoErroEl.hidden = true;
}

// "05/11/2026 a 10/12/2026", ou só "05/11/2026" se for um dia
function textoPeriodo({ inicio, fim }) {
    const de = Regras.formatarData(inicio);
    return inicio === fim ? de : `${de} a ${Regras.formatarData(fim)}`;
}

function irParaMes(anoMes) {
    mesVisao = anoMes;
    reiniciarPaginacao();
    atualizarTela();
}

// Abas, navegador de meses e filtro de mês de acordo com a visão escolhida
function atualizarVisao() {
    const mensal = visao === VISAO.MENSAL;
    const relatorios = visao === VISAO.RELATORIOS;

    abasVisaoEl.querySelectorAll("[data-visao]").forEach((aba) => {
        aba.setAttribute("aria-pressed", String(aba.dataset.visao === visao));
    });
    navegadorMesEl.hidden = !mensal;

    // Relatórios ocupam o lugar do saldo, do histórico e do formulário
    relatorioEl.hidden = !relatorios;
    painelSaldoEl.hidden = relatorios;
    painelPrincipalEl.hidden = relatorios;
    mesVisaoEl.textContent = Regras.formatarMes(mesVisao);
    btnMesAtualEl.hidden = mesVisao === mesDeHoje();

    // O filtro De/Até do histórico só existe na visão mensal
    filtroInicioGrupoEl.hidden = !mensal;
    filtroFimGrupoEl.hidden = !mensal;
    if (!mensal) periodoErroEl.hidden = true;

    // Na visão mensal, o mês já é o do navegador: o filtro de mês do histórico some.
    // O filtro "Quando" (só futuras) é da visão geral.
    filtroMesGrupoEl.hidden = mensal;
    filtroQuandoGrupoEl.hidden = mensal;
}

// ---------- #19 Ver histórico (com filtros) ----------

function atualizarHistorico() {
    listaEl.replaceChildren(); // limpa a lista

    const temMovimentacoes = movimentacoes.length > 0;
    filtrosEl.hidden = !temMovimentacoes;
    btnLimparTudoEl.hidden = !temMovimentacoes;

    const filtros = lerFiltros();
    // Só as futuras: a mais próxima primeiro. Nos outros casos, a mais recente primeiro.
    const visiveis = Regras.ordenarHistorico(
        Regras.filtrarMovimentacoes(movimentacoes, filtros, hoje()),
        filtros.quando === QUANDO.FUTURAS
    );
    movimentacoesFiltradas = visiveis;

    // Só as primeiras "limiteLista" aparecem; o resto vem com "Carregar mais"
    const exibidas = visiveis.slice(0, limiteLista);

    // Só pode continuar selecionado o que está aparecendo na lista
    // (assim nunca se exclui algo escondido por um filtro ou que ainda não foi carregado)
    idsVisiveis = exibidas.map((mov) => mov.id);
    const aparecendo = new Set(idsVisiveis);
    [...selecionadas].forEach((id) => {
        if (!aparecendo.has(id)) selecionadas.delete(id);
    });

    exibidas.forEach((mov) => listaEl.appendChild(criarItemHistorico(mov)));
    mostrarBotaoCarregarMais();
    atualizarBarraSelecao();

    historicoVazioEl.hidden = visiveis.length > 0;
    historicoVazioEl.textContent = mensagemHistoricoVazio(temMovimentacoes, filtros);

    atualizarTotalFiltrado(filtros, visiveis);
}

// Filtro, visão ou mês mudou: a lista volta para as primeiras 30, rolada até o topo
function atualizarHistoricoDoInicio() {
    reiniciarPaginacao();
    atualizarHistorico();
}

function reiniciarPaginacao() {
    limiteLista = TAMANHO_PAGINA;
    listaEl.scrollTop = 0;
}

// Último item da lista: "Carregar mais 30" e "Mostrando 30 de 85"
function mostrarBotaoCarregarMais() {
    listaEl.querySelector(".carregar-mais")?.remove();
    const restantes = movimentacoesFiltradas.length - idsVisiveis.length;
    if (restantes <= 0) return;

    const li = document.createElement("li");
    li.classList.add("carregar-mais");
    const botao = document.createElement("button");
    botao.type = "button";
    botao.classList.add("btn-carregar-mais");
    botao.dataset.acao = "carregar-mais";
    botao.append(criarIcone(ICONE.seta), `Carregar mais ${Math.min(TAMANHO_PAGINA, restantes)}`);
    const contagem = document.createElement("small");
    contagem.textContent = `Mostrando ${idsVisiveis.length} de ${movimentacoesFiltradas.length}`;
    li.append(botao, contagem);
    listaEl.append(li);
}

// Acrescenta as próximas no fim da lista, sem redesenhar as que já estão lá
// (redesenhar repetiria a animação de entrada e mexeria na rolagem)
function carregarMais() {
    const inicio = idsVisiveis.length;
    limiteLista = inicio + TAMANHO_PAGINA;
    const novas = movimentacoesFiltradas.slice(inicio, limiteLista);
    listaEl.querySelector(".carregar-mais")?.remove();
    novas.forEach((mov) => listaEl.append(criarItemHistorico(mov)));
    idsVisiveis = [...idsVisiveis, ...novas.map((mov) => mov.id)];
    mostrarBotaoCarregarMais();
    atualizarBarraSelecao();

    // Para quem usa o teclado: o foco vai para a primeira movimentação nova
    listaEl.querySelector(`.movimentacao[data-id="${novas[0]?.id}"] .btn-editar`)?.focus({ preventScroll: true });
}

function mensagemHistoricoVazio(temMovimentacoes, filtros) {
    if (!temMovimentacoes) return "Nenhuma movimentação registrada ainda.";
    if (visao === VISAO.MENSAL && !Regras.filtroAtivo(filtrosSemPeriodo(filtros))) {
        if (periodo) {
            return periodo.inicio === periodo.fim
                ? `Nenhuma movimentação em ${textoPeriodo(periodo)}.`
                : `Nenhuma movimentação de ${textoPeriodo(periodo)}.`;
        }
        return `Nenhuma movimentação em ${Regras.formatarMes(mesVisao)}.`;
    }
    if (filtros.quando === QUANDO.FUTURAS && !Regras.filtroAtivo({ ...filtros, quando: FILTRO_TODOS.QUANDO })) {
        return "Nenhuma movimentação futura.";
    }
    return "Nenhuma movimentação encontrada com esses filtros.";
}

function lerFiltros() {
    const filtros = {
        tipo: filtroTipoEl.value,
        // "Quando" só existe na visão geral
        quando: visao === VISAO.GERAL ? filtroQuandoEl.value : FILTRO_TODOS.QUANDO,
        mes: filtroMesEl.value,
        categoria: filtroCategoriaEl.value,
        subcategoria: filtroSubcategoriaEl.value
    };

    // Na visão mensal a lista mostra o mês do navegador, ou o período De/Até, se preenchido
    if (visao === VISAO.MENSAL) {
        if (periodo) {
            return { ...filtros, mes: FILTRO_TODOS.MES, dataInicio: periodo.inicio, dataFim: periodo.fim };
        }
        return { ...filtros, mes: mesVisao };
    }
    return filtros;
}

// Os mesmos filtros, sem o mês (na visão mensal o mês do navegador não conta como "filtro ativo")
function filtrosSemMes(filtros) {
    return { ...filtros, mes: FILTRO_TODOS.MES };
}

// Sem o mês e sem o De/Até: sobra só tipo, categoria e subcategoria
function filtrosSemPeriodo(filtros) {
    return { ...filtrosSemMes(filtros), dataInicio: "", dataFim: "" };
}

// Com algum filtro ativo, mostra o total só das movimentações que aparecem na lista.
// O saldo do topo não muda com os filtros.
function atualizarTotalFiltrado(filtros, visiveis) {
    const ativo = Regras.filtroAtivo(visao === VISAO.MENSAL ? filtrosSemMes(filtros) : filtros);
    btnLimparFiltrosEl.hidden = !ativo;

    // Com De/Até, o resumo do histórico mostra o período em detalhe (mesmo sem movimentações)
    if (visao === VISAO.MENSAL && periodo) {
        mostrarResumoDoPeriodo(visiveis);
        return;
    }

    if (!ativo || visiveis.length === 0) {
        totalFiltradoEl.hidden = true;
        return;
    }

    const { saldo } = Regras.calcularResumo(visiveis);
    totalFiltradoEl.classList.remove("resumo-periodo");
    totalFiltradoEl.textContent = `Total no filtro: ${exibirValor(saldo)} (${textoQuantidade(visiveis.length)})`;
    totalFiltradoEl.hidden = false;
}

// Resumo do histórico com De/Até:
//   05/11/2026 a 12/12/2026 · 2 movimentações
//   Entradas: R$ 0,00 · Saídas: R$ 1.600,00 · Resultado: -R$ 1.600,00
//   Saldo previsto em 12/12/2026: R$ 2.149,50
// Entradas, saídas e resultado são das movimentações da lista (respeitam tipo e categoria).
// O saldo na data final é o saldo de tudo até aquele dia, como no card do topo.
function mostrarResumoDoPeriodo(visiveis) {
    const { entradas, saidas, saldo } = Regras.calcularResumo(visiveis);
    const periodoTodo = Regras.calcularResumoPeriodo(movimentacoes, periodo.inicio, periodo.fim, hoje());
    const sinal = saldo > 0 && valoresVisiveis ? "+" : "";
    const rotuloSaldo = periodoTodo.situacao === SITUACAO_MES.PASSADO ? "Saldo em" : "Saldo previsto em";

    totalFiltradoEl.replaceChildren(
        criarLinhaDeTexto([textoPeriodo(periodo), textoQuantidade(visiveis.length)]),
        criarLinhaDeTexto([
            `Entradas: ${exibirValor(entradas)}`,
            `Saídas: ${exibirValor(saidas)}`,
            `Resultado: ${sinal}${exibirValor(saldo)}`
        ]),
        criarLinhaDeTexto([`${rotuloSaldo} ${Regras.formatarData(periodo.fim)}: ${exibirValor(periodoTodo.saldoFinal)}`])
    );
    totalFiltradoEl.classList.add("resumo-periodo");
    totalFiltradoEl.hidden = false;
}

function textoQuantidade(quantidade) {
    return `${quantidade} ${quantidade === 1 ? "movimentação" : "movimentações"}`;
}

// Recria as opções do filtro de mês com os meses que têm movimentação
function atualizarOpcoesMes() {
    const selecionado = filtroMesEl.value;
    const meses = Regras.listarMeses(movimentacoes);
    filtroMesEl.replaceChildren(
        new Option("Todos os meses", FILTRO_TODOS.MES),
        ...meses.map((anoMes) => new Option(Regras.formatarMes(anoMes), anoMes))
    );
    // Mantém o mês escolhido, se ele ainda existir
    filtroMesEl.value = meses.includes(selecionado) ? selecionado : FILTRO_TODOS.MES;
}

// Recria as opções do filtro de categoria com as categorias usadas
function atualizarOpcoesCategoria() {
    const selecionada = filtroCategoriaEl.value;

    const opcoes = [
        new Option("Todas", FILTRO_TODOS.CATEGORIA),
        ...Regras.listarCategorias(movimentacoes).map((cat) => new Option(cat, cat))
    ];
    if (Regras.existeSemCategoria(movimentacoes)) {
        opcoes.push(new Option("Sem categoria", FILTRO_SEM));
    }
    filtroCategoriaEl.replaceChildren(...opcoes);
    manterSelecao(filtroCategoriaEl, opcoes, selecionada, FILTRO_TODOS.CATEGORIA);

    atualizarOpcoesSubcategoria();
}

// Subcategorias da categoria escolhida no filtro (desativado se nenhuma categoria específica)
function atualizarOpcoesSubcategoria() {
    const selecionada = filtroSubcategoriaEl.value;
    const categoria = filtroCategoriaEl.value;
    const especifica = Regras.categoriaEspecifica(categoria);

    const opcoes = [new Option("Todas", FILTRO_TODOS.SUBCATEGORIA)];
    if (especifica) {
        Regras.listarSubcategorias(movimentacoes, categoria)
            .forEach((sub) => opcoes.push(new Option(sub, sub)));
        if (Regras.existeSemSubcategoria(movimentacoes, categoria)) {
            opcoes.push(new Option("Sem subcategoria", FILTRO_SEM));
        }
    }
    filtroSubcategoriaEl.replaceChildren(...opcoes);
    filtroSubcategoriaEl.disabled = !especifica;
    manterSelecao(filtroSubcategoriaEl, opcoes, selecionada, FILTRO_TODOS.SUBCATEGORIA);
}

// Mantém a opção que estava escolhida, se ela ainda existir; senão volta para "Todas"
function manterSelecao(select, opcoes, selecionada, padrao) {
    const valores = opcoes.map((opcao) => opcao.value);
    select.value = valores.includes(selecionada) ? selecionada : padrao;
}

function limparFiltros() {
    resetarFiltros();
    atualizarHistoricoDoInicio();
}

function resetarFiltros() {
    filtroTipoEl.value = FILTRO_TODOS.TIPO;
    filtroQuandoEl.value = FILTRO_TODOS.QUANDO;
    filtroMesEl.value = FILTRO_TODOS.MES;
    filtroCategoriaEl.value = FILTRO_TODOS.CATEGORIA;
    limparPeriodo();
    atualizarOpcoesSubcategoria();
}

// Monta o item com textContent (nunca innerHTML) para o texto digitado
// pelo usuário não ser interpretado como HTML
function criarItemHistorico(mov) {
    const ehEntrada = mov.tipo === TIPO.ENTRADA;

    const li = document.createElement("li");
    li.classList.add("movimentacao", ehEntrada ? "entrada" : "saida");
    li.dataset.id = mov.id;
    if (mov.id === idEmEdicao) li.classList.add("editando");

    const futura = Regras.ehFutura(mov, hoje());
    if (futura) li.classList.add("futura");
    if (selecionadas.has(mov.id)) li.classList.add("selecionada");

    const info = document.createElement("div");
    info.classList.add("movimentacao-info");

    const titulo = document.createElement("div");
    titulo.classList.add("movimentacao-titulo");

    const descricao = document.createElement("span");
    descricao.classList.add("movimentacao-descricao");
    descricao.textContent = mov.descricao;
    titulo.append(descricao);

    // Etiqueta ao lado do nome: "Alimentação › Mercado"
    const rotulo = Regras.rotuloCategoria(mov);
    if (rotulo) {
        const etiqueta = document.createElement("span");
        etiqueta.classList.add("movimentacao-categoria");
        etiqueta.textContent = rotulo;
        etiqueta.title = rotulo; // mostra o texto inteiro se for cortado
        titulo.append(etiqueta);
    }

    const detalhe = document.createElement("span");
    detalhe.classList.add("movimentacao-data");
    detalhe.textContent = `${Regras.formatarData(mov.data)} · ${ehEntrada ? "Entrada" : "Saída"}`;

    // Selo "3/12": parcela de uma movimentação recorrente
    if (mov.recorrencia) {
        const selo = document.createElement("span");
        selo.classList.add("selo-parcela");
        selo.title = `Parcela ${mov.recorrencia.parcela} de ${mov.recorrencia.total} (repete todo mês)`;
        selo.append(criarIcone(ICONE.repetir), Regras.rotuloParcela(mov));
        detalhe.append(" · ", selo);
    }

    // Selo "Futura": ainda não conta no saldo atual
    if (futura) {
        const selo = document.createElement("span");
        selo.classList.add("selo-futura");
        selo.textContent = "Futura";
        selo.title = "Ainda não conta no saldo atual; entra no saldo previsto";
        detalhe.append(" · ", selo);
    }

    info.append(titulo, detalhe);

    const lado = document.createElement("div");
    lado.classList.add("movimentacao-lado");

    const valor = document.createElement("span");
    valor.classList.add("movimentacao-valor");
    valor.textContent = (ehEntrada ? "+ " : "- ") + exibirValor(mov.valor);

    const acoes = document.createElement("div");
    acoes.classList.add("movimentacao-acoes");
    acoes.append(
        criarBotaoAcao("editar", "✎", `Editar ${mov.descricao}`, mov.id),
        criarBotaoAcao("excluir", "×", `Excluir ${mov.descricao}`, mov.id),
        criarCaixaSelecao(mov)
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

// Caixinha ao lado do ×, para marcar várias movimentações e excluir de uma vez
function criarCaixaSelecao(mov) {
    const caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.classList.add("caixa-selecao");
    caixa.checked = selecionadas.has(mov.id);
    caixa.dataset.id = mov.id;
    caixa.title = "Selecionar";
    caixa.setAttribute("aria-label", `Selecionar ${mov.descricao}`);
    return caixa;
}

// Descobre qual botão foi clicado dentro da lista e chama a função certa
function tratarCliqueNaLista(evento) {
    const botao = evento.target.closest("button[data-acao]");
    if (!botao) return;

    if (botao.dataset.acao === "carregar-mais") {
        carregarMais();
        return;
    }

    const id = Number(botao.dataset.id);
    if (botao.dataset.acao === "editar") {
        iniciarEdicao(id);
    } else if (botao.dataset.acao === "excluir") {
        excluirMovimentacao(id);
    }
}

// ---------- Seleção de várias movimentações ----------

function tratarSelecaoNaLista(evento) {
    const caixa = evento.target.closest(".caixa-selecao");
    if (!caixa) return;

    const id = Number(caixa.dataset.id);
    if (caixa.checked) {
        selecionadas.add(id);
    } else {
        selecionadas.delete(id);
    }
    sincronizarSelecaoNaLista();
}

function selecionarTodas() {
    idsVisiveis.forEach((id) => selecionadas.add(id));
    sincronizarSelecaoNaLista();
}

function cancelarSelecao() {
    selecionadas.clear();
    sincronizarSelecaoNaLista();
}

function cancelarSelecaoComEsc(evento) {
    // Se o menu de dados ou um diálogo estiver aberto, o Esc fecha só ele
    if (evento.key === "Escape" && menuDadosEl.hidden && !modoGerenciador && !algumDialogoAberto()
        && selecionadas.size > 0) {
        cancelarSelecao();
    }
}

// Marca/desmarca caixinhas e destaques sem redesenhar a lista (sem repetir a animação)
function sincronizarSelecaoNaLista() {
    listaEl.querySelectorAll(".movimentacao").forEach((li) => {
        const marcada = selecionadas.has(Number(li.dataset.id));
        li.classList.toggle("selecionada", marcada);
        const caixa = li.querySelector(".caixa-selecao");
        if (caixa) caixa.checked = marcada;
    });
    atualizarBarraSelecao();
}

// Barra "2 selecionadas · -R$ 450,50 | Selecionar todas | Cancelar | Excluir selecionadas"
function atualizarBarraSelecao() {
    const quantidade = selecionadas.size;
    barraSelecaoEl.hidden = quantidade === 0;
    listaEl.classList.toggle("modo-selecao", quantidade > 0);
    if (quantidade === 0) return;

    const escolhidas = movimentacoes.filter((mov) => selecionadas.has(mov.id));
    const { saldo } = Regras.calcularResumo(escolhidas);
    const texto = quantidade === 1 ? "1 selecionada" : `${quantidade} selecionadas`;
    selecaoResumoEl.textContent = `${texto} · ${exibirValor(saldo)}`;

    btnSelecionarTodasEl.hidden = idsVisiveis.every((id) => selecionadas.has(id));
    btnExcluirSelecionadasEl.textContent = quantidade === 1 ? "Excluir selecionada" : `Excluir ${quantidade}`;
}

function excluirSelecionadas() {
    const quantidade = selecionadas.size;
    if (quantidade === 0) return;

    const texto = quantidade === 1 ? "a movimentação selecionada" : `as ${quantidade} movimentações selecionadas`;
    const confirmou = confirm(`Excluir ${texto}? Essa ação não pode ser desfeita.`);
    if (!confirmou) return;

    const novaLista = Regras.excluirMovimentacoes(movimentacoes, selecionadas);
    if (!Armazenamento.salvarMovimentacoes(novaLista)) {
        mostrarAviso("Não foi possível excluir. Verifique se o navegador permite armazenamento local.", "erro");
        return;
    }

    movimentacoes = novaLista;

    // Se a movimentação aberta no formulário foi excluída, sai da edição
    if (idEmEdicao !== null && selecionadas.has(idEmEdicao)) {
        sairModoEdicao();
    }

    selecionadas.clear();
    atualizarTela();
    mostrarAviso(quantidade === 1 ? "1 movimentação excluída." : `${quantidade} movimentações excluídas.`);
}

// ---------- Mostrar / ocultar valores (botão "olho") ----------

function alternarVisibilidade() {
    valoresVisiveis = !valoresVisiveis;
    Armazenamento.salvarValoresVisiveis(valoresVisiveis);
    aplicarVisibilidade();
    atualizarResumo();
    atualizarHistorico();
    if (visao === VISAO.RELATORIOS) atualizarRelatorio();
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

// ---------- Modo claro / noturno ----------

function alternarTema() {
    temaAtual = temaAtual === Armazenamento.TEMA.ESCURO ? Armazenamento.TEMA.CLARO : Armazenamento.TEMA.ESCURO;
    Armazenamento.salvarTema(temaAtual);
    aplicarTema();
}

// As cores de cada tema ficam no CSS; aqui só marca qual tema está ativo e atualiza o botão
function aplicarTema() {
    const noturno = temaAtual === Armazenamento.TEMA.ESCURO;
    const rotulo = noturno ? "Ativar modo claro" : "Ativar modo noturno";

    document.documentElement.dataset.tema = temaAtual;
    btnTemaEl.setAttribute("aria-pressed", String(noturno));
    btnTemaEl.setAttribute("aria-label", rotulo);
    btnTemaEl.title = rotulo;
    metaCorNavegadorEl.setAttribute("content", COR_BARRA_NAVEGADOR[temaAtual]);
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

// ---------- Seletor de período (relatórios, exportar e importar) ----------

// Monta, dentro do container, a escolha do período: botões com os tipos (Mês, Vários meses,
// Ano...) e os campos de cada tipo. "aoMudar" é chamada sempre que a escolha muda.
// Devolve { definirOpcoes, definirEscolha, lerEscolha, mostrarErro }.
function criarSeletorPeriodo(container, prefixo, tipos, aoMudar) {
    const raiz = document.createElement("div");
    raiz.className = "seletor-periodo";

    const grupoTipos = document.createElement("div");
    grupoTipos.className = "periodo-tipos";
    grupoTipos.setAttribute("role", "radiogroup");
    grupoTipos.setAttribute("aria-label", "Período");

    const radios = tipos.map((tipo) => {
        const rotulo = document.createElement("label");
        rotulo.className = "periodo-tipo";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `${prefixo}-tipo`;
        radio.value = tipo;
        const texto = document.createElement("span");
        texto.textContent = NOME_PERIODO[tipo];
        rotulo.append(radio, texto);
        grupoTipos.append(rotulo);
        return radio;
    });

    // Um campo com rótulo e select; "tipos" diz em quais tipos de período ele aparece
    function criarCampo(texto, sufixo, tiposDoCampo) {
        const grupo = document.createElement("div");
        grupo.className = "filtro periodo-campo";
        grupo.dataset.tipos = tiposDoCampo.join(" ");
        const rotulo = document.createElement("label");
        rotulo.htmlFor = `${prefixo}-${sufixo}`;
        rotulo.textContent = texto;
        const select = document.createElement("select");
        select.id = `${prefixo}-${sufixo}`;
        grupo.append(rotulo, select);
        return { grupo, select };
    }

    const campoMes = criarCampo("Mês", "mes", [TIPO_PERIODO.MES]);
    const campoDe = criarCampo("De", "de", [TIPO_PERIODO.MESES]);
    const campoAte = criarCampo("Até", "ate", [TIPO_PERIODO.MESES]);
    const campoAno = criarCampo("Ano", "ano", [TIPO_PERIODO.ANO]);
    const campos = [campoMes, campoDe, campoAte, campoAno];

    const linhaCampos = document.createElement("div");
    linhaCampos.className = "periodo-campos";
    linhaCampos.append(...campos.map((campo) => campo.grupo));

    const erro = document.createElement("p");
    erro.className = "filtro-periodo-erro";
    erro.setAttribute("role", "alert");
    erro.hidden = true;

    raiz.append(grupoTipos, linhaCampos, erro);
    container.replaceChildren(raiz);

    function tipoEscolhido() {
        const marcado = radios.find((radio) => radio.checked);
        return marcado ? marcado.value : tipos[0];
    }

    function mostrarCamposDoTipo() {
        const tipo = tipoEscolhido();
        campos.forEach(({ grupo }) => {
            grupo.hidden = !grupo.dataset.tipos.split(" ").includes(tipo);
        });
        linhaCampos.hidden = campos.every(({ grupo }) => grupo.hidden);
    }

    grupoTipos.addEventListener("change", () => {
        mostrarCamposDoTipo();
        aoMudar();
    });
    campos.forEach(({ select }) => select.addEventListener("change", aoMudar));

    // Mantém o valor escolhido se ele ainda existir; senão usa o padrão
    function preencher(select, opcoes, padrao) {
        const atual = select.value;
        select.replaceChildren(...opcoes.map(([valor, texto]) => new Option(texto, valor)));
        const valores = opcoes.map(([valor]) => valor);
        select.value = valores.includes(atual) ? atual : padrao;
    }

    // meses: ["AAAA-MM", ...] em ordem crescente | anos: ["AAAA", ...]
    // mesPadrao: mês sugerido para "Mês" e "Até" (o mais recente, se não for informado)
    function definirOpcoes({ meses, anos, mesPadrao }) {
        const recentes = [...meses].reverse(); // mais recente primeiro, como no filtro do histórico
        const opcoesMes = recentes.map((mes) => [mes, Regras.formatarMes(mes)]);
        const ultimo = meses.includes(mesPadrao) ? mesPadrao : meses[meses.length - 1];
        const indiceUltimo = meses.indexOf(ultimo);
        const primeiroSugerido = meses[Math.max(0, indiceUltimo - 5)];

        preencher(campoMes.select, opcoesMes, ultimo);
        preencher(campoDe.select, opcoesMes, primeiroSugerido);
        preencher(campoAte.select, opcoesMes, ultimo);
        preencher(campoAno.select, anos.map((ano) => [ano, ano]), anos[0]);
        mostrarCamposDoTipo();
    }

    function definirEscolha(escolha) {
        radios.forEach((radio) => {
            radio.checked = radio.value === escolha.tipo;
        });
        if (escolha.mes) campoMes.select.value = escolha.mes;
        if (escolha.inicio) campoDe.select.value = escolha.inicio;
        if (escolha.fim) campoAte.select.value = escolha.fim;
        if (escolha.ano) {
            // O ano pode ainda não estar nas opções (lista vazia): cria a opção
            if (![...campoAno.select.options].some((opcao) => opcao.value === escolha.ano)) {
                campoAno.select.append(new Option(escolha.ano, escolha.ano));
            }
            campoAno.select.value = escolha.ano;
        }
        mostrarCamposDoTipo();
    }

    function lerEscolha() {
        return {
            tipo: tipoEscolhido(),
            mes: campoMes.select.value,
            inicio: campoDe.select.value,
            fim: campoAte.select.value,
            ano: campoAno.select.value
        };
    }

    function mostrarErro(mensagem) {
        erro.textContent = mensagem || "";
        erro.hidden = !mensagem;
    }

    return Object.freeze({ definirOpcoes, definirEscolha, lerEscolha, mostrarErro });
}

// ---------- Relatórios ----------

// Valor curto para os eixos e rótulos dos gráficos: "R$ 800", "R$ 2.500", "R$ 15 mil".
// Com o "olho" fechado, devolve null (o gráfico não mostra números).
function valorCurto(numero) {
    if (!valoresVisiveis) return null;
    return Math.abs(numero) >= 10000 ? formatoCompacto.format(numero) : formatoSemCentavos.format(numero);
}

// "42%"; um valor pequeno, mas que existe, aparece como "<1%" (e não "0%")
function porcentagem(numero) {
    if (numero > 0 && numero < 0.005) return "<1%";
    return formatoPorcentagem.format(numero);
}

// Meses que o seletor do relatório oferece: dos dados e, pelo menos, os últimos 12 meses
function mesesDoRelatorio() {
    const mesAtual = mesDeHoje();
    const limites = Regras.limitesDosMeses(movimentacoes);
    const inicio = [Regras.deslocarMes(mesAtual, -11), limites?.inicio].filter(Boolean).sort()[0];
    const fim = [mesAtual, limites?.fim].filter(Boolean).sort().reverse()[0];
    return Regras.listarMesesEntre(inicio, fim);
}

function anosDoRelatorio() {
    const anos = new Set([hoje().slice(0, 4), ...Regras.listarAnos(movimentacoes)]);
    return [...anos].sort().reverse();
}

function atualizarRelatorio() {
    Graficos.esconderDica();
    seletorRelatorio.definirOpcoes({
        meses: mesesDoRelatorio(),
        anos: anosDoRelatorio(),
        mesPadrao: mesDeHoje()
    });

    const semDados = movimentacoes.length === 0;
    btnRelatorioCsvEl.hidden = semDados;
    btnRelatorioImprimirEl.hidden = semDados;
    if (semDados) {
        relatorioAtual = null;
        relatorioSubtituloEl.textContent = "";
        seletorRelatorio.mostrarErro("");
        mostrarRelatorioVazio("Registre movimentações para ver os relatórios.");
        return;
    }

    const periodo = Regras.resolverPeriodo(seletorRelatorio.lerEscolha(), movimentacoes, hoje());
    seletorRelatorio.mostrarErro(periodo.erro);
    if (periodo.erro) return; // mantém o relatório anterior até a escolha ficar válida

    const relatorio = Relatorios.gerarRelatorio(movimentacoes, periodo, hoje());
    relatorioAtual = relatorio;

    const partes = [relatorio.descricao, textoQuantidade(relatorio.contagem.movimentacoes)];
    if (relatorio.situacao !== SITUACAO_MES.PASSADO) partes.push("inclui valores previstos");
    if (relatorio.contagem.ajustes > 0) partes.push("inclui ajuste de saldo de um período exportado");
    relatorioSubtituloEl.replaceChildren(criarLinhaDeTexto(partes));

    if (relatorio.vazio) {
        btnRelatorioCsvEl.hidden = true;
        btnRelatorioImprimirEl.hidden = true;
        mostrarRelatorioVazio(`Nenhuma movimentação em ${relatorio.descricao}. Escolha outro período.`);
        return;
    }

    relatorioVazioEl.hidden = true;
    relatorioConteudoEl.hidden = false;

    desenharCartoes(relatorio);
    desenharGraficosMensais(relatorio);
    desenharInformacoes(relatorio);
    desenharDestaques(relatorio);
    desenharCategorias(relatorio.categoriasSaidas, categoriasSaidasEl, categoriasSaidasVazioEl, "saida");
    desenharCategorias(relatorio.categoriasEntradas, categoriasEntradasEl, categoriasEntradasVazioEl, "entrada");
    desenharMaioresSaidas(relatorio);
    desenharTabela(relatorio);
}

function mostrarRelatorioVazio(mensagem) {
    relatorioVazioEl.textContent = mensagem;
    relatorioVazioEl.hidden = false;
    relatorioConteudoEl.hidden = true;
}

// Cartões do topo: entradas, saídas, resultado e saldo no fim do período
function desenharCartoes(relatorio) {
    const { totais, anterior, situacao } = relatorio;
    const terminou = situacao === SITUACAO_MES.PASSADO;
    const sinal = totais.resultado > 0 && valoresVisiveis ? "+" : "";

    let detalheResultado = "";
    if (relatorio.taxaEconomia !== null) {
        detalheResultado = relatorio.taxaEconomia >= 0
            ? `Guardou ${porcentagem(relatorio.taxaEconomia)} das entradas`
            : `Gastou ${porcentagem(-relatorio.taxaEconomia)} a mais do que recebeu`;
    } else if (totais.saidas > 0) {
        detalheResultado = "Sem entradas no período";
    }

    relatorioCartoesEl.replaceChildren(
        criarCartao("entrada", "Entradas", exibirValor(totais.entradas),
            textoVariacao(anterior?.variacaoEntradas, anterior, true)),
        criarCartao("saida", "Saídas", exibirValor(totais.saidas),
            textoVariacao(anterior?.variacaoSaidas, anterior, false)),
        criarCartao(totais.resultado < 0 ? "negativo" : "resultado", "Resultado",
            `${sinal}${exibirValor(totais.resultado)}`, { texto: detalheResultado }),
        criarCartao("saldo-final", terminou ? "Saldo no fim do período" : "Saldo previsto no fim",
            exibirValor(totais.saldoFinal), { texto: `Começou com ${exibirValor(totais.saldoInicial)}` })
    );
}

// "↑ 12% vs. Julho a Dezembro de 2025"; a cor diz se é bom (mais entradas, menos saídas) ou ruim
function textoVariacao(variacao, anterior, subirEhBom) {
    if (!anterior) return { texto: "Sem dados do período anterior para comparar" };
    if (variacao === null || variacao === undefined) return { texto: `Nada no período anterior (${anterior.descricao})` };
    if (Math.abs(variacao) < 0.005) return { texto: `Igual a ${anterior.descricao}` };
    const subiu = variacao > 0;
    return {
        texto: `${subiu ? "↑" : "↓"} ${porcentagem(Math.abs(variacao))} vs. ${anterior.descricao}`,
        classe: subiu === subirEhBom ? "bom" : "ruim"
    };
}

function criarCartao(classe, rotulo, valor, detalhe) {
    const cartao = document.createElement("div");
    cartao.className = `relatorio-cartao ${classe}`;

    const titulo = document.createElement("span");
    titulo.className = "relatorio-cartao-rotulo";
    titulo.textContent = rotulo;

    const numero = document.createElement("strong");
    numero.className = "relatorio-cartao-valor";
    numero.textContent = valor;

    cartao.append(titulo, numero);
    if (detalhe?.texto) {
        const texto = document.createElement("span");
        texto.className = `relatorio-cartao-detalhe ${detalhe.classe || ""}`.trim();
        texto.textContent = detalhe.texto;
        cartao.append(texto);
    }
    return cartao;
}

// Gráficos de entradas por mês, saídas por mês e saldo no fim de cada mês
function desenharGraficosMensais(relatorio) {
    const { periodo } = relatorio;
    const variosAnos = periodo.inicio.slice(0, 4) !== periodo.fim.slice(0, 4);

    const base = relatorio.meses.map((mes) => {
        const previsto = mes.situacao !== SITUACAO_MES.PASSADO;
        return {
            mes,
            previsto,
            rotulo: Regras.rotuloCurtoMes(mes.mes, variosAnos),
            titulo: `${Regras.formatarMes(mes.mes)}${previsto ? " (previsto)" : ""}`
        };
    });

    const desenharBarras = (container, campo, classe, nome) => {
        const total = relatorio.totais[campo];
        if (total === 0) {
            container.replaceChildren(criarNota(`Nenhuma ${nome.toLowerCase().slice(0, -1)} no período.`));
            return;
        }
        Graficos.barras(container, base.map((item) => ({
            rotulo: item.rotulo,
            valor: item.mes[campo],
            previsto: item.previsto,
            titulo: item.titulo,
            descricaoAcessivel: `${item.titulo}: ${nome} ${exibirValor(item.mes[campo])}`,
            linhasDica: [
                { rotulo: nome, valor: exibirValor(item.mes[campo]), classe },
                { rotulo: item.mes.quantidade === 1 ? "movimentação no mês" : "movimentações no mês", valor: String(item.mes.quantidade) }
            ]
        })), {
            classe,
            descricao: `${nome} por mês, ${relatorio.descricao}`,
            formatarEixo: valorCurto,
            rotuloMaior: valorCurto
        });
    };

    desenharBarras(graficoEntradasEl, "entradas", "entrada", "Entradas");
    desenharBarras(graficoSaidasEl, "saidas", "saida", "Saídas");

    Graficos.linha(graficoSaldoEl, base.map((item) => {
        const sinal = item.mes.resultado > 0 && valoresVisiveis ? "+" : "";
        const linhasDica = [
            { rotulo: item.previsto ? "saldo previsto no fim do mês" : "saldo no fim do mês", valor: exibirValor(item.mes.saldoFinal), classe: "evolucao" },
            { rotulo: "resultado do mês", valor: `${sinal}${exibirValor(item.mes.resultado)}` }
        ];
        if (item.mes.ajustes !== 0) {
            linhasDica.push({ rotulo: "ajuste de saldo", valor: exibirValor(item.mes.ajustes) });
        }
        return {
            rotulo: item.rotulo,
            valor: item.mes.saldoFinal,
            previsto: item.previsto,
            titulo: item.titulo,
            descricaoAcessivel: `${item.titulo}: saldo no fim do mês ${exibirValor(item.mes.saldoFinal)}`,
            linhasDica
        };
    }), {
        classe: "evolucao",
        descricao: `Saldo no fim de cada mês, ${relatorio.descricao}`,
        formatarEixo: valorCurto,
        rotuloMaior: valorCurto
    });
}

function criarNota(texto) {
    const nota = document.createElement("p");
    nota.className = "relatorio-nota grafico-vazio";
    nota.textContent = texto;
    return nota;
}

// Lista de "rótulo: valor" (<dt>/<dd>); linhas com valor vazio não aparecem
function preencherLista(elemento, linhas) {
    elemento.replaceChildren(...linhas
        .filter(([, valor]) => valor)
        .flatMap(([rotulo, valor]) => {
            const dt = document.createElement("dt");
            dt.textContent = rotulo;
            const dd = document.createElement("dd");
            dd.textContent = valor;
            return [dt, dd];
        }));
}

function desenharInformacoes(relatorio) {
    const { contagem, medias, totais, taxaEconomia } = relatorio;
    const quantidadeMeses = contagem.meses === 1 ? "1 mês" : `${contagem.meses} meses`;

    let economia = "";
    if (taxaEconomia !== null) {
        economia = taxaEconomia >= 0
            ? `${porcentagem(taxaEconomia)} das entradas`
            : `Negativa: gastou ${porcentagem(-taxaEconomia)} a mais do que recebeu`;
    }

    preencherLista(relatorioInformacoesEl, [
        ["Período", `${relatorio.descricao} (${quantidadeMeses})`],
        ["Movimentações", `${contagem.movimentacoes} (${contagem.entradas} ${contagem.entradas === 1 ? "entrada" : "entradas"} e ${contagem.saidas} ${contagem.saidas === 1 ? "saída" : "saídas"})`],
        ["Saldo no início do período", exibirValor(totais.saldoInicial)],
        ["Média de entradas por mês", exibirValor(medias.entradasPorMes)],
        ["Média de saídas por mês", exibirValor(medias.saidasPorMes)],
        ["Valor médio de cada saída", medias.valorPorSaida === null ? "" : exibirValor(medias.valorPorSaida)],
        ["Taxa de economia", economia],
        ["Categorias usadas", contagem.categorias ? String(contagem.categorias) : "Nenhuma"],
        ["Movimentações futuras (previstas)", contagem.futuras ? String(contagem.futuras) : ""],
        ["Ajustes de saldo (períodos exportados)", contagem.ajustes ? exibirValor(totais.ajustes) : ""]
    ]);
}

// "Salário · 05/10/2026 · R$ 5.000,00"
function textoMovimentacao(mov) {
    return mov ? `${mov.descricao} · ${Regras.formatarData(mov.data)} · ${exibirValor(mov.valor)}` : "";
}

// "Março de 2026 · R$ 3.200,00"
function textoMes(mes, campo, comSinal = false) {
    if (!mes) return "";
    const sinal = comSinal && mes[campo] > 0 && valoresVisiveis ? "+" : "";
    return `${Regras.formatarMes(mes.mes)} · ${sinal}${exibirValor(mes[campo])}`;
}

function desenharDestaques(relatorio) {
    const { destaques } = relatorio;
    const mesesComMovimentacao = relatorio.meses.filter((mes) => mes.quantidade > 0).length;
    const comparaMeses = mesesComMovimentacao >= 2;

    preencherLista(relatorioDestaquesEl, [
        ["Maior entrada", textoMovimentacao(destaques.maiorEntrada)],
        ["Maior saída", textoMovimentacao(destaques.maiorSaida)],
        ["Mês com mais entradas", comparaMeses ? textoMes(destaques.mesMaisEntradas, "entradas") : ""],
        ["Mês com mais saídas", comparaMeses ? textoMes(destaques.mesMaisSaidas, "saidas") : ""],
        ["Melhor mês (resultado)", comparaMeses ? textoMes(destaques.melhorMes, "resultado", true) : ""],
        ["Pior mês (resultado)", comparaMeses ? textoMes(destaques.piorMes, "resultado", true) : ""]
    ]);
}

function desenharCategorias(categorias, lista, vazio, classe) {
    vazio.hidden = categorias.length > 0;
    lista.hidden = categorias.length === 0;
    Graficos.categorias(lista, categorias.map((item) => {
        // Subcategorias mais usadas: "Mercado R$ 900,00 · Restaurante R$ 300,00"
        const subcategorias = item.subcategorias
            .filter((sub) => sub.nome)
            .slice(0, 3)
            .map((sub) => `${sub.nome} ${exibirValor(sub.total)}`)
            .join(" · ");
        let destaque = "";
        if (item.semCategoria) destaque = "sem-categoria";
        else if (item.outras) destaque = "outras";
        return {
            nome: item.semCategoria ? "Sem categoria" : item.categoria,
            destaque,
            total: item.total,
            valorTexto: exibirValor(item.total),
            percentualTexto: item.percentual === null ? "" : porcentagem(item.percentual),
            detalhe: subcategorias
        };
    }), { classe });
}

function desenharMaioresSaidas(relatorio) {
    const itens = relatorio.maioresSaidas.map((mov) => {
        const li = document.createElement("li");
        li.className = "relatorio-maior";

        const info = document.createElement("span");
        info.className = "relatorio-maior-info";
        const nome = document.createElement("span");
        nome.className = "relatorio-maior-nome";
        nome.textContent = mov.descricao;
        const detalhe = document.createElement("small");
        const rotulo = Regras.rotuloCategoria(mov);
        detalhe.textContent = rotulo ? `${Regras.formatarData(mov.data)} · ${rotulo}` : Regras.formatarData(mov.data);
        info.append(nome, detalhe);

        const valor = document.createElement("span");
        valor.className = "relatorio-maior-valor";
        valor.textContent = `- ${exibirValor(mov.valor)}`;

        li.append(info, valor);
        return li;
    });
    relatorioMaioresEl.replaceChildren(...itens);
    relatorioMaioresEl.hidden = itens.length === 0;
    relatorioMaioresVazioEl.hidden = itens.length > 0;
}

function celula(texto, classe) {
    const td = document.createElement("td");
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
}

// Tabela "Mês a mês": os mesmos números dos gráficos
function desenharTabela(relatorio) {
    const comSinal = (numero) => `${numero > 0 && valoresVisiveis ? "+" : ""}${exibirValor(numero)}`;

    tabelaCorpoEl.replaceChildren(...relatorio.meses.map((mes) => {
        const tr = document.createElement("tr");
        if (mes.situacao !== SITUACAO_MES.PASSADO) tr.classList.add("previsto");

        const th = document.createElement("th");
        th.scope = "row";
        th.textContent = Regras.formatarMes(mes.mes);
        if (mes.situacao !== SITUACAO_MES.PASSADO) {
            const selo = document.createElement("span");
            selo.className = "selo-futura";
            selo.textContent = mes.situacao === SITUACAO_MES.ATUAL ? "Atual" : "Previsto";
            th.append(" ", selo);
        }

        tr.append(
            th,
            celula(exibirValor(mes.entradas), "valor-entrada"),
            celula(exibirValor(mes.saidas), "valor-saida"),
            celula(comSinal(mes.resultado), mes.resultado < 0 ? "valor-negativo" : ""),
            celula(exibirValor(mes.saldoFinal), mes.saldoFinal < 0 ? "valor-negativo" : ""),
            celula(String(mes.quantidade))
        );
        return tr;
    }));

    const { totais, contagem } = relatorio;
    const total = document.createElement("tr");
    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = "Total";
    total.append(
        th,
        celula(exibirValor(totais.entradas), "valor-entrada"),
        celula(exibirValor(totais.saidas), "valor-saida"),
        celula(comSinal(totais.resultado), totais.resultado < 0 ? "valor-negativo" : ""),
        celula(exibirValor(totais.saldoFinal), totais.saldoFinal < 0 ? "valor-negativo" : ""),
        celula(String(contagem.movimentacoes))
    );
    tabelaRodapeEl.replaceChildren(total);
}

// Planilha com a tabela "Mês a mês" (o caractere invisível BOM, "\uFEFF", faz o Excel reconhecer os acentos)
function baixarRelatorioCSV() {
    if (!relatorioAtual || relatorioAtual.vazio) return;
    baixarArquivo(
        `\uFEFF${Relatorios.montarCSV(relatorioAtual)}`,
        `coinn-relatorio-${Regras.nomeArquivoPeriodo(relatorioAtual.periodo)}.csv`,
        "text/csv;charset=utf-8"
    );
    mostrarAviso("Planilha do relatório baixada.");
}

// ---------- #21 Exportar dados (por período, com opção de remover) ----------

function abrirExportar() {
    fecharMenuDados();

    if (movimentacoes.length === 0) {
        mostrarAviso("Não há movimentações para exportar.", "erro");
        return;
    }

    seletorExportar.definirOpcoes({
        meses: Regras.listarMeses(movimentacoes).reverse(),
        anos: Regras.listarAnos(movimentacoes)
    });
    seletorExportar.definirEscolha({ tipo: TIPO_PERIODO.TUDO });
    exportarRemoverEl.checked = false;
    exportarAjusteEl.checked = true;
    atualizarPreviaExportar();
    dialogoExportarEl.showModal();
}

// O que vai ser exportado com a escolha atual: { periodo, lista, erro? }
function lerExportacao() {
    const escolha = seletorExportar.lerEscolha();
    const periodo = Regras.resolverPeriodo(escolha, movimentacoes, hoje());
    if (periodo.erro) return { erro: periodo.erro };
    return {
        escolha,
        periodo,
        lista: Regras.filtrarPorPeriodo(movimentacoes, periodo),
        tudo: escolha.tipo === TIPO_PERIODO.TUDO
    };
}

function atualizarPreviaExportar() {
    const exportacao = lerExportacao();
    seletorExportar.mostrarErro(exportacao.erro);
    exportarErroEl.hidden = true;
    if (exportacao.erro) {
        exportarPreviaEl.textContent = "";
        btnConfirmarExportarEl.disabled = true;
        return;
    }

    const { periodo, lista, tudo } = exportacao;
    const descricao = tudo ? "Todos os dados" : Regras.descreverPeriodo(periodo);

    if (lista.length === 0) {
        exportarPreviaEl.textContent = `Nenhuma movimentação em ${descricao}.`;
        btnConfirmarExportarEl.disabled = true;
        exportarRemoverEl.disabled = true;
        exportarRemoverOpcoesEl.hidden = true;
        return;
    }

    const { entradas, saidas, saldo } = Regras.calcularResumo(lista);
    exportarPreviaEl.replaceChildren(
        criarLinhaDeTexto([descricao, textoQuantidade(lista.length)]),
        criarLinhaDeTexto([
            `Entradas: ${exibirValor(entradas)}`,
            `Saídas: ${exibirValor(saidas)}`,
            `Resultado: ${saldo > 0 && valoresVisiveis ? "+" : ""}${exibirValor(saldo)}`
        ])
    );

    // Remover: só períodos que já terminaram
    const erroRemocao = Regras.validarRemocaoDoPeriodo(periodo, hoje());
    exportarRemoverEl.disabled = Boolean(erroRemocao);
    if (erroRemocao) exportarRemoverEl.checked = false;
    const usado = Armazenamento.tamanhoDasMovimentacoes();
    exportarEspacoEl.textContent = erroRemocao
        || `Libera cerca de ${textoTamanho(JSON.stringify(lista).length)} dos ${textoTamanho(usado)} que a Coinn usa no navegador `
        + `(o limite é de uns ${textoTamanho(Armazenamento.LIMITE_APROXIMADO)}). Para trazer de volta, importe o arquivo.`;

    const remover = exportarRemoverEl.checked;
    exportarRemoverOpcoesEl.hidden = !remover;
    btnConfirmarExportarEl.textContent = remover ? "Exportar e remover" : "Exportar";
    btnConfirmarExportarEl.disabled = false;
    if (!remover) return;

    // Ajuste de saldo: guarda o resultado do período para o saldo não mudar
    const ajuste = Regras.criarAjusteDeSaldo(lista, periodo, 0);
    exportarAjusteEl.disabled = !ajuste.movimentacao;
    exportarAlertaEl.hidden = true;

    if (ajuste.erro) {
        exportarAjusteTextoEl.textContent = ajuste.erro;
        exportarAjusteEl.checked = false;
    } else if (!ajuste.movimentacao) {
        exportarAjusteTextoEl.textContent = "O resultado do período é zero: o saldo não muda, não precisa de ajuste.";
    } else {
        const mov = ajuste.movimentacao;
        const sinal = mov.tipo === TIPO.ENTRADA ? "+" : "-";
        exportarAjusteTextoEl.textContent = `Cria "${mov.descricao}" (categoria "${Regras.CATEGORIA_AJUSTE}") `
            + `com ${valoresVisiveis ? sinal : ""}${exibirValor(mov.valor)} em ${Regras.formatarData(mov.data)}, `
            + `no lugar das ${textoQuantidade(lista.length)}.`;
    }

    if (ajuste.movimentacao && !exportarAjusteEl.checked) {
        exportarAlertaEl.textContent = `Sem o ajuste, o saldo de hoje muda em ${saldo > 0 && valoresVisiveis ? "-" : ""}`
            + `${exibirValor(Math.abs(saldo))}, porque essas movimentações saem da conta. `
            + "Os relatórios também deixam de mostrar esse período.";
        exportarAlertaEl.hidden = false;
    }
}

function confirmarExportar(evento) {
    evento.preventDefault();
    const exportacao = lerExportacao();
    if (exportacao.erro || exportacao.lista.length === 0) return;

    const { periodo, lista, tudo } = exportacao;
    const remover = exportarRemoverEl.checked && !exportarRemoverEl.disabled;
    const comAjuste = remover && exportarAjusteEl.checked && !exportarAjusteEl.disabled;
    const descricao = tudo ? "todos os dados" : Regras.descreverPeriodo(periodo);

    // Confere o ajuste antes de baixar, para não gerar o arquivo e depois falhar
    const agora = Date.now();
    const ajuste = comAjuste ? Regras.criarAjusteDeSaldo(lista, periodo, agora) : { movimentacao: null };
    if (ajuste.erro) {
        exportarErroEl.textContent = ajuste.erro;
        exportarErroEl.hidden = false;
        return;
    }

    const nome = tudo
        ? `coinn-movimentacoes-${hoje()}.json`
        : `coinn-movimentacoes-${Regras.nomeArquivoPeriodo(periodo)}.json`;
    const conteudo = Regras.montarExportacao(lista, new Date(agora).toISOString(), periodo);
    baixarArquivo(JSON.stringify(conteudo, null, 2), nome, "application/json");

    if (!remover) {
        dialogoExportarEl.close();
        mostrarAviso(`${textoQuantidade(lista.length)} ${lista.length === 1 ? "exportada" : "exportadas"} (${descricao}).`);
        return;
    }

    const confirmou = confirm(
        `O arquivo "${nome}" foi gerado. Confira se ele foi salvo antes de continuar.\n\n` +
        `Remover agora as ${textoQuantidade(lista.length)} (${descricao}) da Coinn?\n` +
        (ajuste.movimentacao
            ? `O saldo continua igual: entra o ajuste "${ajuste.movimentacao.descricao}".`
            : "O saldo vai mudar, porque elas saem da conta.")
    );
    if (!confirmou) {
        dialogoExportarEl.close();
        mostrarAviso("Arquivo exportado. Nada foi removido.");
        return;
    }

    const { restantes } = Regras.removerPeriodo(movimentacoes, periodo);
    const novaLista = ajuste.movimentacao ? [...restantes, ajuste.movimentacao] : restantes;
    if (!Armazenamento.salvarMovimentacoes(novaLista)) {
        exportarErroEl.textContent = "Não foi possível salvar. As movimentações continuam na Coinn.";
        exportarErroEl.hidden = false;
        return;
    }

    const removidos = new Set(lista.map((mov) => mov.id));
    movimentacoes = novaLista;
    if (idEmEdicao !== null && removidos.has(idEmEdicao)) sairModoEdicao();
    selecionadas.clear();
    dialogoExportarEl.close();
    atualizarTela();
    mostrarAviso(`${textoQuantidade(lista.length)} ${lista.length === 1 ? "exportada e removida" : "exportadas e removidas"}.`);
}

// ---------- #21 Importar dados (por período, incorporando ou substituindo) ----------

async function abrirImportar() {
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

    importacao = {
        nome: arquivo.name,
        lista: resultado.lista,
        ignoradas: resultado.ignoradas,
        periodoDoArquivo: resultado.periodo
    };

    const limites = Regras.limitesDosMeses(importacao.lista);
    const partes = [arquivo.name, textoQuantidade(importacao.lista.length), Regras.descreverPeriodo(limites)];
    if (importacao.ignoradas > 0) {
        partes.push(`${importacao.ignoradas} ${importacao.ignoradas === 1 ? "inválida ignorada" : "inválidas ignoradas"}`);
    }
    importarArquivoEl.replaceChildren(criarLinhaDeTexto(partes));

    seletorImportar.definirOpcoes({
        meses: Regras.listarMeses(importacao.lista).reverse(),
        anos: Regras.listarAnos(importacao.lista)
    });
    seletorImportar.definirEscolha({ tipo: TIPO_PERIODO.TUDO });
    formImportarEl.querySelector('input[name="modo-importar"][value="incorporar"]').checked = true;
    formImportarEl.querySelectorAll('input[name="conflito-importar"]').forEach((radio) => {
        radio.checked = false;
    });
    importarErroEl.hidden = true;

    atualizarPreviaImportar();
    dialogoImportarEl.showModal();
}

// O que vai ser importado com as escolhas atuais do diálogo
function lerImportacao() {
    const periodo = Regras.resolverPeriodo(seletorImportar.lerEscolha(), importacao.lista, hoje());
    if (periodo.erro) return { erro: periodo.erro };

    const modo = formImportarEl.querySelector('input[name="modo-importar"]:checked').value;
    const conflitoMarcado = formImportarEl.querySelector('input[name="conflito-importar"]:checked');
    return {
        periodo,
        modo,
        escolhidas: Regras.filtrarPorPeriodo(importacao.lista, periodo),
        conflito: conflitoMarcado ? conflitoMarcado.value : null
    };
}

function atualizarPreviaImportar() {
    if (!importacao) return;

    const leitura = lerImportacao();
    seletorImportar.mostrarErro(leitura.erro);
    importarConflitosEl.hidden = true;
    importarAlertaEl.hidden = true;
    if (leitura.erro) {
        importarPreviaEl.textContent = "";
        btnConfirmarImportarEl.disabled = true;
        return;
    }

    const { periodo, modo, escolhidas, conflito } = leitura;
    const descricao = Regras.descreverPeriodo(periodo);
    const minhasNoPeriodo = Regras.filtrarPorPeriodo(movimentacoes, periodo).length;

    importarModoPeriodoTextoEl.textContent = `Apaga as suas ${textoQuantidade(minhasNoPeriodo)} desse período `
        + `(${descricao}) e coloca as do arquivo. O resto fica igual.`;
    importarModoTudoTextoEl.textContent = movimentacoes.length
        ? `Apaga as ${textoQuantidade(movimentacoes.length)} da Coinn e fica só com o arquivo.`
        : "A Coinn está vazia: fica só com o arquivo.";

    if (escolhidas.length === 0) {
        importarPreviaEl.textContent = `O arquivo não tem movimentações em ${descricao}.`;
        btnConfirmarImportarEl.disabled = true;
        return;
    }

    if (modo === MODO_IMPORTACAO.SUBSTITUIR_PERIODO) {
        importarPreviaEl.replaceChildren(
            criarLinhaDeTexto([descricao, `entram ${textoQuantidade(escolhidas.length)} do arquivo`]),
            criarLinhaDeTexto([`saem as suas ${textoQuantidade(minhasNoPeriodo)} desse período`])
        );
        btnConfirmarImportarEl.disabled = false;
        return;
    }

    if (modo === MODO_IMPORTACAO.SUBSTITUIR_TUDO) {
        importarPreviaEl.replaceChildren(
            criarLinhaDeTexto([`Fica só com as ${textoQuantidade(escolhidas.length)} do arquivo (${descricao})`]),
            criarLinhaDeTexto([`saem todas as ${textoQuantidade(movimentacoes.length)} atuais`])
        );
        btnConfirmarImportarEl.disabled = false;
        return;
    }

    // Incorporar
    const { novas, iguais, conflitos } = Regras.compararImportacao(movimentacoes, escolhidas);
    const desfeitos = Regras.ajustesDesfeitos(movimentacoes, importacao.periodoDoArquivo, periodo);
    const sobrepostos = Regras.ajustesSobrepostos(movimentacoes, periodo, desfeitos);

    const linhas = [
        criarLinhaDeTexto([`${descricao}: ${textoQuantidade(escolhidas.length)} no arquivo`]),
        criarLinhaDeTexto([
            `${novas.length} ${novas.length === 1 ? "nova" : "novas"}`,
            `${iguais.length} já ${iguais.length === 1 ? "está" : "estão"} na Coinn`,
            `${conflitos.length} em conflito`
        ])
    ];
    desfeitos.forEach((mov) => {
        linhas.push(criarLinhaDeTexto([`O ajuste "${mov.descricao}" sai, porque as movimentações originais voltam`]));
    });
    importarPreviaEl.replaceChildren(...linhas);

    if (sobrepostos.length > 0) {
        const nomes = sobrepostos.map((mov) => `"${mov.descricao}"`).join(", ");
        importarAlertaEl.textContent = `Atenção: a Coinn tem o ajuste de saldo ${nomes} nesse período. `
            + "Importar essas movimentações pode contar os mesmos valores duas vezes. "
            + "Para desfazer um ajuste, importe o arquivo inteiro daquela exportação.";
        importarAlertaEl.hidden = false;
    }

    if (conflitos.length > 0) {
        mostrarConflitos(conflitos);
    }

    const nadaMuda = novas.length === 0 && conflitos.length === 0 && desfeitos.length === 0;
    if (nadaMuda) {
        importarPreviaEl.append(criarLinhaDeTexto(["Nada novo: tudo isso já está na Coinn."]));
    }
    btnConfirmarImportarEl.disabled = nadaMuda || (conflitos.length > 0 && !conflito);
}

// Lista as movimentações em conflito: "Mercado (12/10/2025): valor R$ 450,00 → R$ 460,00"
function mostrarConflitos(conflitos) {
    const NOMES_CAMPOS = {
        tipo: "tipo", valor: "valor", data: "data", descricao: "descrição", categoria: "categoria", subcategoria: "subcategoria"
    };
    const formatar = (campo, valor) => {
        if (campo === "valor") return exibirValor(valor);
        if (campo === "data") return Regras.formatarData(valor);
        if (campo === "tipo") return valor === TIPO.ENTRADA ? "entrada" : "saída";
        return valor || "(vazio)";
    };

    importarConflitosTextoEl.textContent = conflitos.length === 1
        ? "1 movimentação do arquivo já existe na Coinn com dados diferentes:"
        : `${conflitos.length} movimentações do arquivo já existem na Coinn com dados diferentes:`;

    const itens = conflitos.slice(0, MAX_CONFLITOS_MOSTRADOS).map(({ atual, importada }) => {
        const li = document.createElement("li");
        const nome = document.createElement("strong");
        nome.textContent = `${atual.descricao} (${Regras.formatarData(atual.data)})`;
        const diferencas = Regras.diferencasDeConteudo(atual, importada)
            .map(({ campo, atual: minha, arquivo }) => (
                `${NOMES_CAMPOS[campo]}: ${formatar(campo, minha)} → ${formatar(campo, arquivo)}`
            ))
            .join("; ");
        li.append(nome, ` ${diferencas}`);
        return li;
    });
    if (conflitos.length > MAX_CONFLITOS_MOSTRADOS) {
        const resto = document.createElement("li");
        resto.textContent = `e mais ${conflitos.length - MAX_CONFLITOS_MOSTRADOS}...`;
        itens.push(resto);
    }
    importarConflitosListaEl.replaceChildren(...itens);
    importarConflitosEl.hidden = false;
}

function confirmarImportar(evento) {
    evento.preventDefault();
    if (!importacao) return;

    const leitura = lerImportacao();
    if (leitura.erro || leitura.escolhidas.length === 0) return;
    const { periodo, modo, escolhidas, conflito } = leitura;

    if (modo === MODO_IMPORTACAO.SUBSTITUIR_TUDO && movimentacoes.length > 0) {
        const confirmou = confirm(
            `Apagar as ${textoQuantidade(movimentacoes.length)} da Coinn e ficar só com as ${escolhidas.length} do arquivo? `
            + "Essa ação não pode ser desfeita."
        );
        if (!confirmou) return;
    }

    const comparacao = modo === MODO_IMPORTACAO.INCORPORAR
        ? Regras.compararImportacao(movimentacoes, escolhidas)
        : null;
    const agora = Date.now();
    const resultado = Regras.aplicarImportacao(movimentacoes, escolhidas, {
        modo,
        periodo,
        periodoDoArquivo: importacao.periodoDoArquivo,
        usarArquivoNosConflitos: conflito === "arquivo",
        gerarId: (indice) => agora + indice
    });

    if (!Armazenamento.salvarMovimentacoes(resultado.lista)) {
        importarErroEl.textContent = "Não foi possível salvar os dados importados.";
        importarErroEl.hidden = false;
        return;
    }

    movimentacoes = resultado.lista;
    if (idEmEdicao !== null) sairModoEdicao();
    selecionadas.clear();
    resetarFiltros();
    dialogoImportarEl.close();
    atualizarTela();
    mostrarAviso(mensagemImportacao(modo, resultado, comparacao));
}

function mensagemImportacao(modo, resultado, comparacao) {
    const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
    if (modo !== MODO_IMPORTACAO.INCORPORAR) {
        return `${plural(resultado.adicionadas, "movimentação importada", "movimentações importadas")}`
            + ` (${plural(resultado.removidas, "substituída", "substituídas")}).`;
    }
    const partes = [plural(resultado.adicionadas, "movimentação adicionada", "movimentações adicionadas")];
    if (resultado.substituidas) partes.push(plural(resultado.substituidas, "atualizada", "atualizadas"));
    if (comparacao.iguais.length) partes.push(plural(comparacao.iguais.length, "já existia", "já existiam"));
    if (comparacao.conflitos.length && !resultado.substituidas) {
        partes.push(plural(comparacao.conflitos.length, "mantida como estava", "mantidas como estavam"));
    }
    if (resultado.ajustesRemovidos) partes.push("ajuste de saldo desfeito");
    return `${partes.join(", ")}.`;
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
    atualizarVisao();
    atualizarResumo();
    atualizarOpcoesMes();
    atualizarOpcoesCategoria();
    sincronizarCategorias();
    atualizarSeletoresCategoria();
    atualizarHistorico();
    if (visao === VISAO.RELATORIOS) atualizarRelatorio();
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

function algumDialogoAberto() {
    return document.querySelector("dialog[open]") !== null;
}

// Gera um arquivo e faz o download por um link temporário
function baixarArquivo(conteudo, nome, tipo) {
    const arquivo = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

// "38 KB", "1,2 MB"
function textoTamanho(caracteres) {
    const kb = caracteres / 1024;
    if (kb < 1024) return `${Math.max(1, Math.round(kb)).toLocaleString("pt-BR")} KB`;
    return `${(kb / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

// Grava a lista e, se deu certo, passa a usá-la. Devolve true/false.
function salvar(novaLista) {
    if (!Armazenamento.salvarMovimentacoes(novaLista)) return false;
    movimentacoes = novaLista;
    return true;
}

// Ícone SVG com os traços informados (ver ICONE)
function criarIcone(caminhos) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "icone");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    caminhos.forEach((d) => {
        const caminho = document.createElementNS("http://www.w3.org/2000/svg", "path");
        caminho.setAttribute("d", d);
        svg.append(caminho);
    });
    return svg;
}

// "AAAA-MM" de hoje
function mesDeHoje() {
    return hoje().slice(0, 7);
}
