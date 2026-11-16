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
 * Períodos de meses: relatórios, exportação e importação trabalham com um intervalo
 * de meses { inicio, fim } ("AAAA-MM", os dois incluídos): um mês, vários meses ou um ano.
 *
 * Modelo de dados de uma movimentação:
 *   { id, tipo ("entrada" | "saida"), valor, data ("AAAA-MM-DD"), descricao,
 *     categoria, subcategoria, dataModificacao?, ajuste? }
 *   categoria e subcategoria são texto livre e opcionais ("" quando não informadas).
 *   Só existe subcategoria se houver categoria.
 *   ajuste = { inicio, fim, quantidade }: só existe na movimentação "Ajuste de saldo",
 *   criada quando um período é exportado e removido (guarda o resultado daquele período
 *   para o saldo não mudar).
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

    // Situação de um mês em relação a hoje (usado na visão mensal)
    const SITUACAO_MES = Object.freeze({
        PASSADO: "passado",
        ATUAL: "atual",
        FUTURO: "futuro"
    });

    // Versão do formato do arquivo exportado.
    // v1: sem categoria | v2: com categoria e subcategoria
    // v3: com o período exportado, um resumo e o campo "ajuste" (arquivos v1 e v2 continuam aceitos)
    const VERSAO_EXPORTACAO = 3;

    // Como escolher o período (relatórios, exportar e importar)
    const TIPO_PERIODO = Object.freeze({
        MES: "mes",
        MESES: "meses",
        ANO: "ano",
        TUDO: "tudo",
        ULTIMOS_12: "ultimos12" // só nos relatórios
    });

    // Como juntar os dados de um arquivo importado com os dados atuais
    const MODO_IMPORTACAO = Object.freeze({
        INCORPORAR: "incorporar",          // junta: adiciona o que é novo, não apaga nada
        SUBSTITUIR_PERIODO: "periodo",     // troca só as movimentações do período escolhido
        SUBSTITUIR_TUDO: "tudo"            // apaga tudo e fica só com o arquivo
    });

    // Categoria da movimentação criada ao exportar e remover um período
    const CATEGORIA_AJUSTE = "Ajuste de saldo";

    // Campos que decidem se duas movimentações são "a mesma" na importação
    const CAMPOS_CONTEUDO = Object.freeze(["tipo", "valor", "data", "descricao", "categoria", "subcategoria"]);

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

    // Exclui várias de uma vez (seleção múltipla no histórico)
    function excluirMovimentacoes(lista, ids) {
        const excluir = new Set(ids);
        return lista.filter((mov) => !excluir.has(mov.id));
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

    // ---------- Visão mensal ----------

    // "2026-02" -> "2026-02-28" (considera ano bissexto)
    function ultimoDiaDoMes(anoMes) {
        const [ano, mes] = anoMes.split("-").map(Number);
        // Dia 0 do mês seguinte = último dia deste mês
        const dia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        return `${anoMes}-${String(dia).padStart(2, "0")}`;
    }

    // Anda meses para frente (positivo) ou para trás (negativo): ("2026-12", 1) -> "2027-01"
    function deslocarMes(anoMes, quantidade) {
        const [ano, mes] = anoMes.split("-").map(Number);
        const total = ano * 12 + (mes - 1) + quantidade;
        const novoAno = Math.floor(total / 12);
        const novoMes = (total % 12) + 1;
        return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
    }

    // O mês já terminou, é o mês de hoje ou ainda vai chegar?
    function situacaoDoMes(anoMes, hoje) {
        const mesDeHoje = hoje.slice(0, 7);
        if (anoMes < mesDeHoje) return SITUACAO_MES.PASSADO;
        if (anoMes > mesDeHoje) return SITUACAO_MES.FUTURO;
        return SITUACAO_MES.ATUAL;
    }

    // Período escolhido na visão mensal: as duas datas precisam existir e o fim não pode
    // vir antes do início. Retorna uma mensagem de erro, ou null se estiver tudo certo.
    function validarPeriodo(inicio, fim) {
        if (!dataValida(inicio) || !dataValida(fim)) {
            return "Informe a data inicial e a final.";
        }
        if (fim < inicio) {
            return "A data final não pode ser antes da inicial.";
        }
        return null;
    }

    // Resumo de um período (datas "AAAA-MM-DD", incluindo o primeiro e o último dia):
    // - entradas, saídas e resultado: só as movimentações do período (inclusive as futuras)
    // - saldoInicial: saldo acumulado antes do primeiro dia
    // - saldoFinal: saldo acumulado até o último dia (previsto, se o período não acabou)
    // - situacao: o período já terminou, está acontecendo ou ainda vai começar
    function calcularResumoPeriodo(lista, inicio, fim, hoje) {
        const doPeriodo = lista.filter((mov) => mov.data >= inicio && mov.data <= fim);
        const { entradas, saidas, saldo } = calcularResumo(doPeriodo);

        let situacao = SITUACAO_MES.ATUAL;
        if (fim < hoje) situacao = SITUACAO_MES.PASSADO;
        else if (inicio > hoje) situacao = SITUACAO_MES.FUTURO;

        return {
            entradas,
            saidas,
            resultado: saldo,
            saldoInicial: calcularResumo(lista.filter((mov) => mov.data < inicio)).saldo,
            saldoFinal: calcularResumo(lista.filter((mov) => mov.data <= fim)).saldo,
            quantidade: doPeriodo.length,
            quantidadeFuturas: doPeriodo.filter((mov) => ehFutura(mov, hoje)).length,
            situacao
        };
    }

    // Resumo de um mês ("AAAA-MM"): é o resumo do período do dia 1 ao último dia
    function calcularResumoMensal(lista, anoMes, hoje) {
        return {
            ...calcularResumoPeriodo(lista, `${anoMes}-01`, ultimoDiaDoMes(anoMes), hoje),
            situacao: situacaoDoMes(anoMes, hoje)
        };
    }

    // ---------- #19 Histórico: filtros e ordenação ----------

    // Filtro que não foi informado vale como "todos".
    // dataInicio e dataFim ("AAAA-MM-DD") limitam o período; "" = sem limite.
    function completarFiltros(filtros = {}) {
        return {
            tipo: filtros.tipo ?? FILTRO_TODOS.TIPO,
            mes: filtros.mes ?? FILTRO_TODOS.MES,
            categoria: filtros.categoria ?? FILTRO_TODOS.CATEGORIA,
            subcategoria: filtros.subcategoria ?? FILTRO_TODOS.SUBCATEGORIA,
            dataInicio: filtros.dataInicio ?? "",
            dataFim: filtros.dataFim ?? ""
        };
    }

    // A subcategoria só vale quando uma categoria específica foi escolhida
    function categoriaEspecifica(categoria) {
        return categoria !== FILTRO_TODOS.CATEGORIA && categoria !== FILTRO_SEM;
    }

    function passaNosFiltros(mov, { tipo, mes, categoria, subcategoria, dataInicio, dataFim }) {
        if (tipo !== FILTRO_TODOS.TIPO && mov.tipo !== tipo) return false;
        if (mes !== FILTRO_TODOS.MES && !mov.data.startsWith(mes)) return false;
        if (dataInicio && mov.data < dataInicio) return false;
        if (dataFim && mov.data > dataFim) return false;

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
        const { tipo, mes, categoria, subcategoria, dataInicio, dataFim } = completarFiltros(filtros);
        return tipo !== FILTRO_TODOS.TIPO
            || mes !== FILTRO_TODOS.MES
            || Boolean(dataInicio)
            || Boolean(dataFim)
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

    // ---------- Períodos de meses (relatórios, exportar e importar) ----------

    // "2026-11" é um mês válido; "2026-13" e "2026-1" não
    function anoMesValido(anoMes) {
        return typeof anoMes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(anoMes);
    }

    // Primeiro e último mês com movimentação: { inicio, fim }, ou null se a lista estiver vazia
    function limitesDosMeses(lista) {
        if (lista.length === 0) return null;
        const meses = lista.map((mov) => mov.data.slice(0, 7)).sort();
        return { inicio: meses[0], fim: meses[meses.length - 1] };
    }

    // Anos que têm movimentação, do mais recente para o mais antigo
    function listarAnos(lista) {
        return [...new Set(lista.map((mov) => mov.data.slice(0, 4)))].sort().reverse();
    }

    // Todos os meses do intervalo, em ordem: ("2026-11", "2027-01") -> ["2026-11", "2026-12", "2027-01"]
    function listarMesesEntre(inicio, fim) {
        const meses = [];
        for (let mes = inicio; mes <= fim; mes = deslocarMes(mes, 1)) {
            meses.push(mes);
        }
        return meses;
    }

    // Transforma a escolha da tela em um intervalo { inicio, fim } ("AAAA-MM"), ou { erro }.
    //   { tipo: "mes", mes }               um mês
    //   { tipo: "meses", inicio, fim }     vários meses seguidos
    //   { tipo: "ano", ano }               janeiro a dezembro do ano
    //   { tipo: "tudo" }                   do primeiro ao último mês da lista
    //   { tipo: "ultimos12" }              os 12 meses que terminam no mês de hoje
    function resolverPeriodo(escolha, lista, hoje) {
        switch (escolha?.tipo) {
        case TIPO_PERIODO.MES:
            if (!anoMesValido(escolha.mes)) return { erro: "Escolha o mês." };
            return { inicio: escolha.mes, fim: escolha.mes };
        case TIPO_PERIODO.MESES:
            if (!anoMesValido(escolha.inicio) || !anoMesValido(escolha.fim)) {
                return { erro: "Escolha o mês inicial e o final." };
            }
            if (escolha.fim < escolha.inicio) {
                return { erro: "O mês final não pode ser antes do inicial." };
            }
            return { inicio: escolha.inicio, fim: escolha.fim };
        case TIPO_PERIODO.ANO:
            if (!/^\d{4}$/.test(String(escolha.ano))) return { erro: "Escolha o ano." };
            return { inicio: `${escolha.ano}-01`, fim: `${escolha.ano}-12` };
        case TIPO_PERIODO.TUDO:
            return limitesDosMeses(lista) || { erro: "Não há movimentações." };
        case TIPO_PERIODO.ULTIMOS_12: {
            const mesDeHoje = hoje.slice(0, 7);
            return { inicio: deslocarMes(mesDeHoje, -11), fim: mesDeHoje };
        }
        default:
            return { erro: "Escolha um período." };
        }
    }

    function estaNoPeriodo(mov, { inicio, fim }) {
        const mes = mov.data.slice(0, 7);
        return mes >= inicio && mes <= fim;
    }

    function filtrarPorPeriodo(lista, periodo) {
        return lista.filter((mov) => estaNoPeriodo(mov, periodo));
    }

    function ehAnoInteiro({ inicio, fim }) {
        return inicio.slice(0, 4) === fim.slice(0, 4) && inicio.endsWith("-01") && fim.endsWith("-12");
    }

    // "Novembro de 2026" | "Ano de 2026" | "Janeiro a Março de 2026" | "Novembro de 2025 a Março de 2026"
    function descreverPeriodo(periodo) {
        const { inicio, fim } = periodo;
        if (inicio === fim) return formatarMes(inicio);
        if (ehAnoInteiro(periodo)) return `Ano de ${inicio.slice(0, 4)}`;
        if (inicio.slice(0, 4) === fim.slice(0, 4)) {
            return `${formatarMes(inicio).split(" ")[0]} a ${formatarMes(fim)}`;
        }
        return `${formatarMes(inicio)} a ${formatarMes(fim)}`;
    }

    // Versão curta, que cabe na descrição do ajuste: "11/2026" | "2026" | "01/2026 a 03/2026"
    function descreverPeriodoCurto(periodo) {
        const curto = (anoMes) => `${anoMes.slice(5)}/${anoMes.slice(0, 4)}`;
        if (periodo.inicio === periodo.fim) return curto(periodo.inicio);
        if (ehAnoInteiro(periodo)) return periodo.inicio.slice(0, 4);
        return `${curto(periodo.inicio)} a ${curto(periodo.fim)}`;
    }

    // Parte do nome do arquivo: "2026-11" | "2026" | "2026-01_a_2026-03"
    function nomeArquivoPeriodo(periodo) {
        if (periodo.inicio === periodo.fim) return periodo.inicio;
        if (ehAnoInteiro(periodo)) return periodo.inicio.slice(0, 4);
        return `${periodo.inicio}_a_${periodo.fim}`;
    }

    // Rótulo do mês no eixo dos gráficos: "Mar" ou, com o ano, "Mar/26"
    function rotuloCurtoMes(anoMes, comAno = false) {
        const nome = NOMES_MESES[Number(anoMes.slice(5)) - 1].slice(0, 3);
        return comAno ? `${nome}/${anoMes.slice(2, 4)}` : nome;
    }

    // ---------- Exportar e remover um período ----------

    // Só dá para remover meses que já terminaram: o mês atual e os seguintes ainda mudam
    // (e o ajuste, que fica no último dia do período, precisa ser uma data que já passou)
    function validarRemocaoDoPeriodo(periodo, hoje) {
        if (periodo.fim >= hoje.slice(0, 7)) {
            return "Só dá para remover meses que já terminaram. Escolha um período antes do mês atual.";
        }
        return null;
    }

    // Separa as movimentações do período (que vão para o arquivo e saem da Coinn) das que ficam
    function removerPeriodo(lista, periodo) {
        return {
            restantes: lista.filter((mov) => !estaNoPeriodo(mov, periodo)),
            removidas: filtrarPorPeriodo(lista, periodo)
        };
    }

    // Movimentação "Ajuste de saldo": guarda o resultado do período removido, no último dia
    // dele, para o saldo de hoje e dos meses seguintes continuar igual.
    // Devolve { movimentacao } (null se o resultado for zero) ou { erro }.
    function criarAjusteDeSaldo(removidas, periodo, id) {
        const { saldo } = calcularResumo(removidas);
        if (saldo === 0) return { movimentacao: null };

        const valor = Math.abs(saldo);
        if (valor > LIMITES.VALOR_MAX) {
            return { erro: `O resultado do período passa de ${formatarMoeda(LIMITES.VALOR_MAX)}. Escolha um período menor.` };
        }

        return {
            movimentacao: {
                id,
                tipo: saldo > 0 ? TIPO.ENTRADA : TIPO.SAIDA,
                valor,
                data: ultimoDiaDoMes(periodo.fim),
                descricao: `Saldo de ${descreverPeriodoCurto(periodo)}`,
                categoria: CATEGORIA_AJUSTE,
                subcategoria: "",
                ajuste: { inicio: periodo.inicio, fim: periodo.fim, quantidade: removidas.length }
            }
        };
    }

    function ehAjuste(mov) {
        return Boolean(mov.ajuste);
    }

    // ---------- Exportar e importar ----------

    // periodo: { inicio, fim } exportado (null = todos os dados)
    function montarExportacao(lista, exportadoEm, periodo = null) {
        const { entradas, saidas, saldo } = calcularResumo(lista);
        return {
            app: "coinn",
            versao: VERSAO_EXPORTACAO,
            exportadoEm,
            periodo: periodo ? { inicio: periodo.inicio, fim: periodo.fim } : null,
            resumo: { quantidade: lista.length, entradas, saidas, resultado: saldo },
            movimentacoes: lista
        };
    }

    // { inicio, fim } válido, ou null
    function lerPeriodo(periodo) {
        if (!anoMesValido(periodo?.inicio) || !anoMesValido(periodo?.fim) || periodo.fim < periodo.inicio) {
            return null;
        }
        return { inicio: periodo.inicio, fim: periodo.fim };
    }

    // Confere o conteúdo do arquivo e devolve { lista, ignoradas, periodo } ou { erro }.
    // Aceita o formato exportado pela Coinn ({ movimentacoes: [...] }) ou só a lista.
    // Arquivos antigos (v1) não têm categoria: as movimentações ficam sem categoria.
    // periodo: o período informado no arquivo (v3), ou null.
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
            const ajuste = lerPeriodo(item.ajuste);
            if (ajuste) {
                movimentacao.ajuste = { ...ajuste, quantidade: Number(item.ajuste.quantidade) || 0 };
            }
            lista.push(movimentacao);
        });

        if (lista.length === 0) {
            return { erro: "Nenhuma movimentação válida encontrada no arquivo." };
        }
        return { lista, ignoradas, periodo: Array.isArray(conteudo) ? null : lerPeriodo(conteudo.periodo) };
    }

    // ---------- Juntar a importação com os dados atuais ----------

    function chaveConteudo(mov) {
        return JSON.stringify(CAMPOS_CONTEUDO.map((campo) => mov[campo]));
    }

    function mesmoConteudo(a, b) {
        return chaveConteudo(a) === chaveConteudo(b);
    }

    // Campos diferentes entre a movimentação atual e a do arquivo: [{ campo, atual, arquivo }]
    function diferencasDeConteudo(atual, arquivo) {
        return CAMPOS_CONTEUDO
            .filter((campo) => atual[campo] !== arquivo[campo])
            .map((campo) => ({ campo, atual: atual[campo], arquivo: arquivo[campo] }));
    }

    // Separa as movimentações do arquivo em:
    // - iguais: já existem na Coinn (mesmo id e mesmo conteúdo, ou outro id com o mesmo conteúdo)
    // - conflitos: mesmo id de uma movimentação atual, mas com algum campo diferente
    // - novas: o resto, que pode ser adicionado sem problema
    // O mesmo conteúdo com outro id só conta como "igual" uma vez para cada movimentação atual
    // (duas compras iguais no mesmo dia no arquivo, e só uma na Coinn = uma igual e uma nova).
    function compararImportacao(atuais, importadas) {
        const porId = new Map(atuais.map((mov) => [mov.id, mov]));
        const disponiveis = new Map();
        atuais.forEach((mov) => {
            const chave = chaveConteudo(mov);
            disponiveis.set(chave, (disponiveis.get(chave) || 0) + 1);
        });
        const usar = (mov) => {
            const chave = chaveConteudo(mov);
            disponiveis.set(chave, disponiveis.get(chave) - 1);
        };

        const novas = [];
        const iguais = [];
        const conflitos = [];
        const semId = [];

        // Primeiro as que têm o mesmo id de uma movimentação atual
        importadas.forEach((importada) => {
            const atual = porId.get(importada.id);
            if (!atual) {
                semId.push(importada);
            } else if (mesmoConteudo(atual, importada)) {
                iguais.push(importada);
                usar(atual);
            } else {
                conflitos.push({ atual, importada });
                usar(atual);
            }
        });

        // Depois as outras: se o mesmo conteúdo ainda está "sobrando" na Coinn, é repetida
        semId.forEach((importada) => {
            if ((disponiveis.get(chaveConteudo(importada)) || 0) > 0) {
                iguais.push(importada);
                usar(importada);
            } else {
                novas.push(importada);
            }
        });

        return { novas, iguais, conflitos };
    }

    // Ajustes de saldo que deixam de fazer sentido porque as movimentações originais voltam:
    // o arquivo é a exportação daquele período e a importação traz o período inteiro.
    function ajustesDesfeitos(atuais, periodoDoArquivo, periodoEscolhido) {
        if (!periodoDoArquivo) return [];
        return atuais.filter((mov) => ehAjuste(mov)
            && mov.ajuste.inicio === periodoDoArquivo.inicio
            && mov.ajuste.fim === periodoDoArquivo.fim
            && periodoEscolhido.inicio <= mov.ajuste.inicio
            && periodoEscolhido.fim >= mov.ajuste.fim);
    }

    // Ajustes de saldo que encostam no período importado e continuam: os valores daquele
    // período podem contar em dobro (no ajuste e nas movimentações importadas)
    function ajustesSobrepostos(atuais, periodoEscolhido, desfeitos = []) {
        const ids = new Set(desfeitos.map((mov) => mov.id));
        return atuais.filter((mov) => ehAjuste(mov)
            && !ids.has(mov.id)
            && mov.ajuste.inicio <= periodoEscolhido.fim
            && mov.ajuste.fim >= periodoEscolhido.inicio);
    }

    // Monta a lista final da importação.
    //   atuais: dados de hoje | importadas: movimentações do arquivo já filtradas pelo período
    //   opcoes: { modo, periodo, periodoDoArquivo, usarArquivoNosConflitos, gerarId }
    // Devolve { lista, adicionadas, substituidas, removidas, ajustesRemovidos }.
    function aplicarImportacao(atuais, importadas, opcoes) {
        const { modo, periodo, periodoDoArquivo, usarArquivoNosConflitos = false, gerarId } = opcoes;

        if (modo === MODO_IMPORTACAO.SUBSTITUIR_TUDO) {
            return {
                lista: importadas,
                adicionadas: importadas.length,
                substituidas: 0,
                removidas: atuais.length,
                ajustesRemovidos: 0
            };
        }

        if (modo === MODO_IMPORTACAO.SUBSTITUIR_PERIODO) {
            const { restantes, removidas } = removerPeriodo(atuais, periodo);
            // Um id que ainda existe fora do período ganha um id novo, para não repetir
            const idsRestantes = new Set(restantes.map((mov) => mov.id));
            const trazidas = importadas.map((mov, indice) => (
                idsRestantes.has(mov.id) ? { ...mov, id: gerarId(indice) } : mov
            ));
            return {
                lista: [...restantes, ...trazidas],
                adicionadas: trazidas.length,
                substituidas: 0,
                removidas: removidas.length,
                ajustesRemovidos: 0
            };
        }

        // Incorporar
        const { novas, conflitos } = compararImportacao(atuais, importadas);
        const desfeitos = new Set(ajustesDesfeitos(atuais, periodoDoArquivo, periodo).map((mov) => mov.id));
        const trocas = new Map(
            usarArquivoNosConflitos ? conflitos.map(({ importada }) => [importada.id, importada]) : []
        );

        const lista = [
            ...atuais
                .filter((mov) => !desfeitos.has(mov.id))
                .map((mov) => trocas.get(mov.id) || mov),
            ...novas
        ];
        return {
            lista,
            adicionadas: novas.length,
            substituidas: trocas.size,
            removidas: 0,
            ajustesRemovidos: desfeitos.size
        };
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
        SITUACAO_MES,
        TIPO_PERIODO,
        MODO_IMPORTACAO,
        CATEGORIA_AJUSTE,
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
        excluirMovimentacoes,
        calcularResumo,
        ehFutura,
        calcularResumoGeral,
        ultimoDiaDoMes,
        deslocarMes,
        situacaoDoMes,
        validarPeriodo,
        calcularResumoPeriodo,
        calcularResumoMensal,
        categoriaEspecifica,
        filtrarMovimentacoes,
        filtroAtivo,
        ordenarHistorico,
        listarMeses,
        anoMesValido,
        limitesDosMeses,
        listarAnos,
        listarMesesEntre,
        resolverPeriodo,
        estaNoPeriodo,
        filtrarPorPeriodo,
        descreverPeriodo,
        descreverPeriodoCurto,
        nomeArquivoPeriodo,
        rotuloCurtoMes,
        validarRemocaoDoPeriodo,
        removerPeriodo,
        criarAjusteDeSaldo,
        ehAjuste,
        montarExportacao,
        lerMovimentacoesImportadas,
        mesmoConteudo,
        diferencasDeConteudo,
        compararImportacao,
        ajustesDesfeitos,
        ajustesSobrepostos,
        aplicarImportacao,
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
