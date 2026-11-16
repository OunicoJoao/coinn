/*
 * app.js
 * Lógica da interface: registrar movimentação (#17), consultar saldo (#18),
 * ver histórico (#19), editar e excluir (#20), categorias e subcategorias, filtros e limpar tudo,
 * movimentações futuras (saldo atual x previsto), visão Geral / Mensal (com filtro De/Até
 * no histórico) e seleção de várias movimentações para excluir de uma vez.
 * Na barra do topo: mostrar/ocultar valores, modo claro/noturno e exportar/importar os dados (#21):
 * exportar um mês, vários meses, um ano ou tudo (e, se quiser, remover esse período da Coinn).
 *
 * Este arquivo só cuida da tela (ler o formulário, desenhar a lista, reagir a cliques).
 * - As regras de negócio (validar, calcular, filtrar, ordenar) ficam em regras.js.
 * - O acesso aos dados fica em storage.js.
 */

/* global Regras, Armazenamento */

// ---------- Constantes ----------

const { TIPO, LIMITES, FILTRO_TODOS, FILTRO_SEM, SITUACAO_MES, TIPO_PERIODO } = Regras;

// Visões do topo da página
const VISAO = Object.freeze({
    GERAL: "geral",   // todas as movimentações; saldo atual + previsto
    MENSAL: "mensal"  // um mês por vez, escolhido no navegador de meses
});

// Nomes das opções de período (exportar e importar)
const NOME_PERIODO = Object.freeze({
    [TIPO_PERIODO.MES]: "Mês",
    [TIPO_PERIODO.MESES]: "Vários meses",
    [TIPO_PERIODO.ANO]: "Ano",
    [TIPO_PERIODO.TUDO]: "Tudo"
});

// Texto mostrado no lugar dos valores quando o "olho" está fechado
const VALOR_OCULTO = "R$ •••••";

// Cor da barra do navegador no celular, em cada tema (igual à barra do topo)
const COR_BARRA_NAVEGADOR = Object.freeze({
    claro: "#fcd97a",
    escuro: "#820AD1"
});

// Tempo que o aviso rápido fica na tela
const DURACAO_AVISO_MS = 3500;

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
const sugestoesCategoriaEl = document.getElementById("sugestoes-categoria");
const sugestoesSubcategoriaEl = document.getElementById("sugestoes-subcategoria");
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

// ---------- Estado ----------

// normalizarMovimentacao garante os campos de categoria em dados salvos antes deles existirem
let movimentacoes = Armazenamento.carregarMovimentacoes().map(Regras.normalizarMovimentacao);

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

// true = valores aparecem; false = aparecem como "R$ •••••"
let valoresVisiveis = Armazenamento.carregarValoresVisiveis();

// "claro" ou "escuro" (o index.html já aplicou o tema salvo antes de a página aparecer)
let temaAtual = Armazenamento.carregarTema();

// Guarda o timer do aviso para poder reiniciá-lo
let timerAviso = null;

// ---------- Inicialização ----------

descricaoEl.maxLength = LIMITES.DESCRICAO_MAX;
categoriaEl.maxLength = LIMITES.CATEGORIA_MAX;
subcategoriaEl.maxLength = LIMITES.CATEGORIA_MAX;
valorEl.min = LIMITES.VALOR_MIN;
valorEl.max = LIMITES.VALOR_MAX;
dataEl.value = hoje();

formEl.addEventListener("submit", registrarMovimentacao);
descricaoEl.addEventListener("input", atualizarContador);
dataEl.addEventListener("input", atualizarAvisoDataFutura);
btnCancelarEdicaoEl.addEventListener("click", cancelarEdicao);
btnLimparTudoEl.addEventListener("click", limparTudo);
filtroTipoEl.addEventListener("change", atualizarHistorico);
filtroMesEl.addEventListener("change", atualizarHistorico);
filtroCategoriaEl.addEventListener("change", () => {
    atualizarOpcoesSubcategoria(); // a lista de subcategorias depende da categoria
    atualizarHistorico();
});
filtroSubcategoriaEl.addEventListener("change", atualizarHistorico);
categoriaEl.addEventListener("input", atualizarSugestoesSubcategoria);
btnLimparFiltrosEl.addEventListener("click", limparFiltros);

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
arquivoImportarEl.addEventListener("change", importarDados);
document.addEventListener("click", fecharMenuAoClicarFora);
document.addEventListener("keydown", fecharMenuComEsc);
document.addEventListener("keydown", cancelarSelecaoComEsc);

// Seletor de período do diálogo de exportar
const seletorExportar = criarSeletorPeriodo(exportarPeriodoEl, "exportar",
    [TIPO_PERIODO.TUDO, TIPO_PERIODO.MES, TIPO_PERIODO.MESES, TIPO_PERIODO.ANO],
    atualizarPreviaExportar);

// Diálogo de exportar
exportarRemoverEl.addEventListener("change", atualizarPreviaExportar);
exportarAjusteEl.addEventListener("change", atualizarPreviaExportar);
formExportarEl.addEventListener("submit", confirmarExportar);
document.querySelectorAll("dialog [data-fechar]").forEach((botao) => {
    botao.addEventListener("click", () => botao.closest("dialog").close());
});

aplicarVisibilidade();
aplicarTema();
atualizarContador();
atualizarTela();

// ---------- #17 Registrar movimentação (e salvar edição) ----------

function registrarMovimentacao(evento) {
    evento.preventDefault(); // evita recarregar a página

    const erro = Regras.validarMovimentacao(lerFormulario());
    if (erro) {
        mostrarErro(erro);
        return;
    }

    // Se já existe "Alimentação" e a pessoa digitou "alimentação", usa a grafia que já existe
    const dados = Regras.aplicarGrafiaExistente(movimentacoes, lerFormulario());

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
        descricao: descricaoEl.value.trim(),
        categoria: categoriaEl.value.trim(),
        subcategoria: subcategoriaEl.value.trim()
    };
}

function limparFormulario() {
    formEl.reset();
    dataEl.value = hoje();
    esconderErro();
    atualizarContador();
    atualizarSugestoesSubcategoria();
    atualizarAvisoDataFutura();
    descricaoEl.focus();
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

    tituloFormEl.textContent = "Editar movimentação";
    btnRegistrarEl.textContent = "Salvar alterações";
    btnCancelarEdicaoEl.hidden = false;
    formContainerEl.classList.add("editando");

    esconderErro();
    atualizarContador();
    atualizarSugestoesSubcategoria();
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
        atualizarHistorico();
        return;
    }

    const erro = Regras.validarPeriodo(inicio, fim);
    periodoErroEl.textContent = erro || "";
    periodoErroEl.hidden = !erro;
    if (erro) return; // mantém a lista como estava até o período ficar válido

    periodo = { inicio, fim };
    atualizarHistorico();
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
    atualizarTela();
}

// Abas, navegador de meses e filtro de mês de acordo com a visão escolhida
function atualizarVisao() {
    const mensal = visao === VISAO.MENSAL;

    abasVisaoEl.querySelectorAll("[data-visao]").forEach((aba) => {
        aba.setAttribute("aria-pressed", String(aba.dataset.visao === visao));
    });
    navegadorMesEl.hidden = !mensal;
    mesVisaoEl.textContent = Regras.formatarMes(mesVisao);
    btnMesAtualEl.hidden = mesVisao === mesDeHoje();

    // O filtro De/Até do histórico só existe na visão mensal
    filtroInicioGrupoEl.hidden = !mensal;
    filtroFimGrupoEl.hidden = !mensal;
    if (!mensal) periodoErroEl.hidden = true;

    // Na visão mensal, o mês já é o do navegador: o filtro de mês do histórico some
    filtroMesGrupoEl.hidden = mensal;
}

// ---------- #19 Ver histórico (com filtros) ----------

function atualizarHistorico() {
    listaEl.replaceChildren(); // limpa a lista

    const temMovimentacoes = movimentacoes.length > 0;
    filtrosEl.hidden = !temMovimentacoes;
    btnLimparTudoEl.hidden = !temMovimentacoes;

    const filtros = lerFiltros();
    const visiveis = Regras.ordenarHistorico(Regras.filtrarMovimentacoes(movimentacoes, filtros));

    // Só pode continuar selecionado o que está aparecendo na lista
    // (assim nunca se exclui algo escondido por um filtro)
    idsVisiveis = visiveis.map((mov) => mov.id);
    const aparecendo = new Set(idsVisiveis);
    [...selecionadas].forEach((id) => {
        if (!aparecendo.has(id)) selecionadas.delete(id);
    });

    visiveis.forEach((mov) => listaEl.appendChild(criarItemHistorico(mov)));
    atualizarBarraSelecao();

    historicoVazioEl.hidden = visiveis.length > 0;
    historicoVazioEl.textContent = mensagemHistoricoVazio(temMovimentacoes, filtros);

    atualizarTotalFiltrado(filtros, visiveis);
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
    return "Nenhuma movimentação encontrada com esses filtros.";
}

function lerFiltros() {
    const filtros = {
        tipo: filtroTipoEl.value,
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

// Sugestões que aparecem ao digitar no campo de categoria do formulário
function atualizarSugestoesCategoria() {
    sugestoesCategoriaEl.replaceChildren(
        ...Regras.listarCategorias(movimentacoes).map((cat) => new Option(cat))
    );
    atualizarSugestoesSubcategoria();
}

// Sugestões de subcategoria: só as da categoria digitada no formulário
function atualizarSugestoesSubcategoria() {
    const categoria = Regras.usarGrafiaExistente(
        categoriaEl.value.trim(),
        Regras.listarCategorias(movimentacoes)
    );
    sugestoesSubcategoriaEl.replaceChildren(
        ...Regras.listarSubcategorias(movimentacoes, categoria).map((sub) => new Option(sub))
    );
}

function limparFiltros() {
    resetarFiltros();
    atualizarHistorico();
}

function resetarFiltros() {
    filtroTipoEl.value = FILTRO_TODOS.TIPO;
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
    if (evento.key === "Escape" && menuDadosEl.hidden && !algumDialogoAberto() && selecionadas.size > 0) {
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

// ---------- Seletor de período (exportar e importar) ----------

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
    const periodo = Regras.resolverPeriodo(escolha, movimentacoes);
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
            + `${exibirValor(Math.abs(saldo))}, porque essas movimentações saem da conta.`;
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
    resetarFiltros();
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
    atualizarVisao();
    atualizarResumo();
    atualizarOpcoesMes();
    atualizarOpcoesCategoria();
    atualizarSugestoesCategoria();
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

// "AAAA-MM" de hoje
function mesDeHoje() {
    return hoje().slice(0, 7);
}
