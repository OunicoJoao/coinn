/*
 * regras.js
 * Regras de negócio do Coinn: validação, cálculos, categorias, filtros, ordenação,
 * importação/exportação e formatação.
 *
 * Tudo aqui é função pura: recebe dados e devolve um resultado, sem mexer
 * na tela (DOM) nem no localStorage. Por isso essas regras podem ser testadas
 * automaticamente com o Node, sem navegador (veja tests/regras.test.js).
 *
 * Padrão de projeto: Module. Tudo fica dentro do objeto "Regras", em vez de
 * espalhar dezenas de funções soltas no escopo global do navegador.
 *
 * Movimentações futuras: uma movimentação com data depois de hoje é "futura".
 * Ela não entra no saldo atual (o dinheiro ainda não entrou/saiu), mas entra no
 * saldo previsto. No dia da data, passa a contar no saldo atual sozinha.
 * As funções que dependem do dia recebem "hoje" como parâmetro ("AAAA-MM-DD"),
 * para continuarem puras e testáveis.
 *
 * Modelo de dados de uma movimentação:
 *   { id, tipo ("entrada" | "saida"), valor, data ("AAAA-MM-DD"), descricao,
 *     categoria, subcategoria, dataModificacao? }
 *   categoria e subcategoria são texto livre e opcionais ("" quando não informadas).
 *   Só existe subcategoria se houver categoria.
 */

/* exported Regras */
const Regras = (function () {
    "use strict";

    // ---------- Constantes ----------

    // "Enum" de tipos: use sempre estas constantes em vez de digitar o texto
    const TIPO = Object.freeze({
        ENTRADA: "entrada",
        SAIDA: "saida"
    });

    const LIMITES = Object.freeze({
        DESCRICAO_MAX: 30,
        CATEGORIA_MAX: 20,
        VALOR_MIN: 0.01,
        VALOR_MAX: 999999.99
    });

    // Valores "sem filtro" dos selects do histórico.
    // Categoria e subcategoria usam um texto que ninguém digitaria,
    // para não confundir com uma categoria real chamada "todas".
    const FILTRO_TODOS = Object.freeze({
        TIPO: "todas",
        MES: "todos",
        CATEGORIA: "__todas__",
        SUBCATEGORIA: "__todas__"
    });

    // Valor do filtro para "Sem categoria" / "Sem subcategoria"
    const FILTRO_SEM = "__sem__";

    // Versão do formato do arquivo exportado.
    // v1: sem categoria | v2: com categoria e subcategoria (arquivos v1 continuam aceitos)
    const VERSAO_EXPORTACAO = 2;

    const NOMES_MESES = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // ---------- Valores, textos e datas ----------

    // Arredonda para 2 casas decimais (centavos)
    function arredondarCentavos(valor) {
        return Math.round(valor * 100) / 100;
    }

    // Texto sem espaços nas pontas; qualquer coisa que não seja texto vira ""
    function textoLimpo(valor) {
        return typeof valor === "string" ? valor.trim() : "";
    }

    // Confere o formato "AAAA-MM-DD" e se a data existe no calendário
    // (o regex sozinho aceitava datas como "2026-13-45" ou "2026-02-31")
    function dataValida(data) {
        if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            return false;
        }
        const [ano, mes, dia] = data.split("-").map(Number);
        const teste = new Date(Date.UTC(ano, mes - 1, dia));
        return teste.getUTCFullYear() === ano
            && teste.getUTCMonth() === mes - 1
            && teste.getUTCDate() === dia;
    }

    // ---------- Validação ----------

    // Retorna uma mensagem de erro, ou null se os dados estiverem válidos.
    // Usada pelo formulário (registrar e editar) e pela importação.
    function validarMovimentacao({ tipo, valor, data, descricao, categoria = "", subcategoria = "" }) {
        if (tipo !== TIPO.ENTRADA && tipo !== TIPO.SAIDA) {
            return "Escolha se é uma entrada ou uma saída.";
        }
        if (!Number.isFinite(valor) || valor < LIMITES.VALOR_MIN) {
            return "Informe um valor maior que zero.";
        }
        if (valor > LIMITES.VALOR_MAX) {
            return `O valor máximo é ${formatarMoeda(LIMITES.VALOR_MAX)}.`;
        }
        if (!dataValida(data)) {
            return "Informe uma data válida.";
        }
        if (textoLimpo(descricao).length === 0) {
            return "Informe uma descrição.";
        }
        if (textoLimpo(descricao).length > LIMITES.DESCRICAO_MAX) {
            return `A descrição pode ter no máximo ${LIMITES.DESCRICAO_MAX} caracteres.`;
        }
        const cat = textoLimpo(categoria);
        const sub = textoLimpo(subcategoria);
        if (cat.length > LIMITES.CATEGORIA_MAX || sub.length > LIMITES.CATEGORIA_MAX) {
            return `Categoria e subcategoria podem ter no máximo ${LIMITES.CATEGORIA_MAX} caracteres.`;
        }
        if (sub && !cat) {
            return "Informe a categoria antes da subcategoria.";
        }
        return null;
    }

    // Monta só os campos que são guardados, já limpos
    function normalizarCampos({ tipo, valor, data, descricao, categoria, subcategoria }) {
        const cat = textoLimpo(categoria);
        return {
            tipo,
            valor: arredondarCentavos(valor),
            data,
            descricao: textoLimpo(descricao),
            categoria: cat,
            subcategoria: cat ? textoLimpo(subcategoria) : ""
        };
    }

    // Garante que toda movimentação salva tenha categoria e subcategoria (texto, "" se vazio).
    // Movimentações registradas antes das categorias existirem não têm esses campos.
    function normalizarMovimentacao(mov) {
        const categoria = textoLimpo(mov.categoria);
        const subcategoria = categoria ? textoLimpo(mov.subcategoria) : "";
        return { ...mov, categoria, subcategoria };
    }

    // ---------- Categorias e subcategorias ----------

    function ordenarSemRepetir(textos) {
        return [...new Set(textos)].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }

    // Categorias já usadas, sem repetir, em ordem alfabética
    function listarCategorias(lista) {
        return ordenarSemRepetir(lista.map((mov) => mov.categoria).filter(Boolean));
    }

    // Subcategorias já usadas dentro de uma categoria
    function listarSubcategorias(lista, categoria) {
        if (!categoria) return [];
        return ordenarSemRepetir(
            lista
                .filter((mov) => mov.categoria === categoria)
                .map((mov) => mov.subcategoria)
                .filter(Boolean)
        );
    }

    function existeSemCategoria(lista) {
        return lista.some((mov) => !mov.categoria);
    }

    function existeSemSubcategoria(lista, categoria) {
        return lista.some((mov) => mov.categoria === categoria && !mov.subcategoria);
    }

    // Se o texto já existe com outra combinação de maiúsculas/minúsculas, usa a versão existente
    function usarGrafiaExistente(texto, existentes) {
        if (!texto) return "";
        const igual = existentes.find(
            (item) => item.toLocaleLowerCase("pt-BR") === texto.toLocaleLowerCase("pt-BR")
        );
        return igual || texto;
    }

    // Se já existe "Alimentação" e a pessoa digitou "alimentação", usa a grafia que já existe
    // (vale também para a subcategoria, dentro da mesma categoria)
    function aplicarGrafiaExistente(lista, dados) {
        const categoria = usarGrafiaExistente(textoLimpo(dados.categoria), listarCategorias(lista));
        const subcategoria = usarGrafiaExistente(
            textoLimpo(dados.subcategoria),
            listarSubcategorias(lista, categoria)
        );
        return { ...dados, categoria, subcategoria };
    }

    // Texto da etiqueta no histórico: "Alimentação › Mercado", "Alimentação" ou ""
    function rotuloCategoria(mov) {
        if (!mov.categoria) return "";
        return mov.subcategoria ? `${mov.categoria} › ${mov.subcategoria}` : mov.categoria;
    }

    // ---------- Criar, editar e excluir ----------
    // Todas devolvem uma NOVA lista, sem alterar a original

    function adicionarMovimentacao(lista, dados, id) {
        return [...lista, { id, ...normalizarCampos(dados) }];
    }

    // Troca os campos da movimentação com esse id e registra quando foi alterada
    function editarMovimentacao(lista, id, dados, dataModificacao) {
        return lista.map((mov) =>
            mov.id === id ? { ...mov, ...normalizarCampos(dados), dataModificacao } : mov
        );
    }

    function excluirMovimentacao(lista, id) {
        return lista.filter((mov) => mov.id !== id);
    }

    // ---------- #18 Saldo ----------

    // Soma em centavos (números inteiros) para evitar erros de ponto flutuante:
    // em JavaScript 0.1 + 0.2 = 0.30000000000000004, o que fazia um saldo zerado
    // aparecer como "-R$ 0,00" em vermelho
    function calcularResumo(lista) {
        let entradasCentavos = 0;
        let saidasCentavos = 0;

        lista.forEach((mov) => {
            const centavos = Math.round(mov.valor * 100);
            if (mov.tipo === TIPO.ENTRADA) {
                entradasCentavos += centavos;
            } else if (mov.tipo === TIPO.SAIDA) {
                saidasCentavos += centavos;
            }
        });

        return {
            entradas: entradasCentavos / 100,
            saidas: saidasCentavos / 100,
            saldo: (entradasCentavos - saidasCentavos) / 100
        };
    }

    // ---------- Movimentações futuras e saldo previsto ----------

    // Futura = data depois de hoje. Comparar texto funciona porque o formato é AAAA-MM-DD.
    function ehFutura(mov, hoje) {
        return mov.data > hoje;
    }

    // Visão geral:
    // - entradas, saídas e saldo: só o que já aconteceu (data até hoje)
    // - saldoPrevisto: inclui também as futuras
    function calcularResumoGeral(lista, hoje) {
        const realizadas = lista.filter((mov) => !ehFutura(mov, hoje));
        return {
            ...calcularResumo(realizadas),
            saldoPrevisto: calcularResumo(lista).saldo,
            quantidadeFuturas: lista.length - realizadas.length
        };
    }

    // ---------- #19 Histórico: filtros e ordenação ----------

    // Filtro que não foi informado vale como "todos"
    function completarFiltros(filtros = {}) {
        return {
            tipo: filtros.tipo ?? FILTRO_TODOS.TIPO,
            mes: filtros.mes ?? FILTRO_TODOS.MES,
            categoria: filtros.categoria ?? FILTRO_TODOS.CATEGORIA,
            subcategoria: filtros.subcategoria ?? FILTRO_TODOS.SUBCATEGORIA
        };
    }

    // A subcategoria só vale quando uma categoria específica foi escolhida
    function categoriaEspecifica(categoria) {
        return categoria !== FILTRO_TODOS.CATEGORIA && categoria !== FILTRO_SEM;
    }

    function passaNosFiltros(mov, { tipo, mes, categoria, subcategoria }) {
        if (tipo !== FILTRO_TODOS.TIPO && mov.tipo !== tipo) return false;
        if (mes !== FILTRO_TODOS.MES && !mov.data.startsWith(mes)) return false;

        if (categoria === FILTRO_SEM) {
            return !mov.categoria;
        }
        if (!categoriaEspecifica(categoria)) {
            return true;
        }
        if (mov.categoria !== categoria) return false;

        if (subcategoria === FILTRO_SEM) return !mov.subcategoria;
        if (subcategoria !== FILTRO_TODOS.SUBCATEGORIA) return mov.subcategoria === subcategoria;
        return true;
    }

    function filtrarMovimentacoes(lista, filtros) {
        const completos = completarFiltros(filtros);
        return lista.filter((mov) => passaNosFiltros(mov, completos));
    }

    function filtroAtivo(filtros) {
        const { tipo, mes, categoria, subcategoria } = completarFiltros(filtros);
        return tipo !== FILTRO_TODOS.TIPO
            || mes !== FILTRO_TODOS.MES
            || categoria !== FILTRO_TODOS.CATEGORIA
            || (categoriaEspecifica(categoria) && subcategoria !== FILTRO_TODOS.SUBCATEGORIA);
    }

    // Mais recente primeiro: ordena pela data e, no mesmo dia, pela ordem de registro (id)
    function ordenarHistorico(lista) {
        return [...lista].sort((a, b) => {
            if (a.data !== b.data) return a.data < b.data ? 1 : -1;
            return b.id - a.id;
        });
    }

    // Meses ("AAAA-MM") que têm movimentação, do mais recente para o mais antigo
    function listarMeses(lista) {
        return [...new Set(lista.map((mov) => mov.data.slice(0, 7)))].sort().reverse();
    }

    // ---------- Exportar e importar ----------

    function montarExportacao(lista, exportadoEm) {
        return {
            app: "coinn",
            versao: VERSAO_EXPORTACAO,
            exportadoEm,
            movimentacoes: lista
        };
    }

    // Confere o conteúdo do arquivo e devolve { lista, ignoradas } ou { erro }.
    // Aceita o formato exportado pela Coinn ({ movimentacoes: [...] }) ou só a lista.
    // Arquivos antigos (v1) não têm categoria: as movimentações ficam sem categoria.
    function lerMovimentacoesImportadas(conteudo, gerarId) {
        const itens = Array.isArray(conteudo) ? conteudo : conteudo?.movimentacoes;
        if (!Array.isArray(itens)) {
            return { erro: "Arquivo não reconhecido. Use um arquivo exportado pela Coinn." };
        }

        const lista = [];
        const idsUsados = new Set();
        let ignoradas = 0;

        itens.forEach((item, indice) => {
            const categoria = textoLimpo(item?.categoria);
            const dados = {
                tipo: item?.tipo,
                valor: Number(item?.valor),
                data: item?.data,
                descricao: textoLimpo(item?.descricao),
                categoria,
                // Subcategoria sem categoria não faz sentido: descarta só a subcategoria
                subcategoria: categoria ? textoLimpo(item?.subcategoria) : ""
            };

            // Reaproveita a mesma validação do formulário
            if (validarMovimentacao(dados) !== null) {
                ignoradas++;
                return;
            }

            // Mantém o id original; cria outro se faltar ou se estiver repetido
            let id = Number(item.id);
            if (!Number.isFinite(id) || idsUsados.has(id)) {
                id = gerarId(indice);
            }
            idsUsados.add(id);

            const movimentacao = { id, ...normalizarCampos(dados) };
            if (typeof item.dataModificacao === "string") {
                movimentacao.dataModificacao = item.dataModificacao;
            }
            lista.push(movimentacao);
        });

        if (lista.length === 0) {
            return { erro: "Nenhuma movimentação válida encontrada no arquivo." };
        }
        return { lista, ignoradas };
    }

    // ---------- Formatação ----------

    const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

    function formatarMoeda(numero) {
        return formatadorMoeda.format(numero);
    }

    // "2026-10-14" -> "14/10/2026"
    // (não usa new Date() porque ele interpreta a data em UTC e pode mostrar o dia anterior)
    function formatarData(dataISO) {
        const [ano, mes, dia] = dataISO.split("-");
        return `${dia}/${mes}/${ano}`;
    }

    // "2026-10" -> "Outubro de 2026"
    function formatarMes(anoMes) {
        const [ano, mes] = anoMes.split("-");
        return `${NOMES_MESES[Number(mes) - 1]} de ${ano}`;
    }

    // Data no fuso do usuário, no formato "AAAA-MM-DD"
    function dataISO(data) {
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        const dia = String(data.getDate()).padStart(2, "0");
        return `${data.getFullYear()}-${mes}-${dia}`;
    }

    // ---------- O que fica disponível para o resto do código ----------

    return Object.freeze({
        TIPO,
        LIMITES,
        FILTRO_TODOS,
        FILTRO_SEM,
        arredondarCentavos,
        dataValida,
        validarMovimentacao,
        normalizarMovimentacao,
        listarCategorias,
        listarSubcategorias,
        existeSemCategoria,
        existeSemSubcategoria,
        usarGrafiaExistente,
        aplicarGrafiaExistente,
        rotuloCategoria,
        adicionarMovimentacao,
        editarMovimentacao,
        excluirMovimentacao,
        calcularResumo,
        ehFutura,
        calcularResumoGeral,
        categoriaEspecifica,
        filtrarMovimentacoes,
        filtroAtivo,
        ordenarHistorico,
        listarMeses,
        montarExportacao,
        lerMovimentacoesImportadas,
        formatarMoeda,
        formatarData,
        formatarMes,
        dataISO
    });
})();

// No navegador, "Regras" vira uma variável global usada pelo app.js.
// No Node (testes), o arquivo é carregado com require().
if (typeof module !== "undefined" && module.exports) {
    module.exports = Regras;
}
