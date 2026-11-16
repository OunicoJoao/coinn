/*
 * regras.test.js
 * Testes automatizados das regras de negócio (js/regras.js).
 * Rodar com: npm test   (ou: node --test)
 *
 * Usa o executor de testes que já vem no Node (node:test), sem instalar nada.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Regras = require("../js/regras.js");

const { TIPO, FILTRO_SEM } = Regras;

// Cria uma movimentação válida; cada teste muda só o campo que interessa
function mov(campos = {}) {
    return {
        id: 1,
        tipo: TIPO.ENTRADA,
        valor: 100,
        data: "2026-10-14",
        descricao: "Salário",
        categoria: "Trabalho",
        subcategoria: "Salário",
        ...campos
    };
}

const ids = (lista) => lista.map((m) => m.id);

describe("validarMovimentacao", () => {
    it("aceita uma movimentação válida", () => {
        assert.equal(Regras.validarMovimentacao(mov()), null);
    });

    it("recusa tipo diferente de entrada ou saída", () => {
        assert.match(Regras.validarMovimentacao(mov({ tipo: "transferencia" })), /entrada ou uma saída/);
    });

    it("recusa valor zero, negativo ou que não é número", () => {
        assert.match(Regras.validarMovimentacao(mov({ valor: 0 })), /maior que zero/);
        assert.match(Regras.validarMovimentacao(mov({ valor: -10 })), /maior que zero/);
        assert.match(Regras.validarMovimentacao(mov({ valor: NaN })), /maior que zero/);
    });

    it("aceita os limites de valor e recusa acima do máximo", () => {
        assert.equal(Regras.validarMovimentacao(mov({ valor: 0.01 })), null);
        assert.equal(Regras.validarMovimentacao(mov({ valor: 999999.99 })), null);
        assert.match(Regras.validarMovimentacao(mov({ valor: 1000000 })), /valor máximo/);
    });

    it("recusa descrição vazia ou só com espaços", () => {
        assert.match(Regras.validarMovimentacao(mov({ descricao: "" })), /descrição/);
        assert.match(Regras.validarMovimentacao(mov({ descricao: "   " })), /descrição/);
    });

    it("aceita descrição com 30 caracteres e recusa com 31", () => {
        assert.equal(Regras.validarMovimentacao(mov({ descricao: "a".repeat(30) })), null);
        assert.match(Regras.validarMovimentacao(mov({ descricao: "a".repeat(31) })), /no máximo 30/);
    });
});

describe("validação de categoria e subcategoria", () => {
    it("categoria e subcategoria são opcionais", () => {
        assert.equal(Regras.validarMovimentacao(mov({ categoria: "", subcategoria: "" })), null);
        assert.equal(Regras.validarMovimentacao(mov({ categoria: undefined, subcategoria: undefined })), null);
    });

    it("aceita categoria sem subcategoria", () => {
        assert.equal(Regras.validarMovimentacao(mov({ subcategoria: "" })), null);
    });

    it("recusa subcategoria sem categoria", () => {
        assert.match(
            Regras.validarMovimentacao(mov({ categoria: "", subcategoria: "Mercado" })),
            /categoria antes da subcategoria/
        );
    });

    it("aceita até 20 caracteres e recusa 21, nos dois campos", () => {
        assert.equal(Regras.validarMovimentacao(mov({ categoria: "a".repeat(20), subcategoria: "b".repeat(20) })), null);
        assert.match(Regras.validarMovimentacao(mov({ categoria: "a".repeat(21) })), /no máximo 20/);
        assert.match(Regras.validarMovimentacao(mov({ subcategoria: "b".repeat(21) })), /no máximo 20/);
    });
});

describe("dataValida (defeito corrigido na Sprint 4)", () => {
    it("aceita datas reais, inclusive 29 de fevereiro em ano bissexto", () => {
        assert.equal(Regras.dataValida("2026-10-14"), true);
        assert.equal(Regras.dataValida("2028-02-29"), true);
    });

    it("recusa datas que não existem no calendário", () => {
        assert.equal(Regras.dataValida("2026-13-45"), false);
        assert.equal(Regras.dataValida("2026-02-31"), false);
        assert.equal(Regras.dataValida("2026-02-29"), false);
    });

    it("recusa formatos errados", () => {
        assert.equal(Regras.dataValida("14/10/2026"), false);
        assert.equal(Regras.dataValida(""), false);
        assert.equal(Regras.dataValida(undefined), false);
    });
});

describe("calcularResumo", () => {
    it("lista vazia dá tudo zero", () => {
        assert.deepEqual(Regras.calcularResumo([]), { entradas: 0, saidas: 0, saldo: 0 });
    });

    it("soma entradas, saídas e calcula o saldo", () => {
        const lista = [
            mov({ id: 1, valor: 2500.5 }),
            mov({ id: 2, tipo: TIPO.SAIDA, valor: 100.2 }),
            mov({ id: 3, tipo: TIPO.SAIDA, valor: 0.1 })
        ];
        assert.deepEqual(Regras.calcularResumo(lista), { entradas: 2500.5, saidas: 100.3, saldo: 2400.2 });
    });

    it("saldo zerado com centavos não fica negativo (defeito corrigido na Sprint 4)", () => {
        // Antes: 0.3 - (0.1 + 0.2) = -0.0000000000000000555 e a tela mostrava "-R$ 0,00" em vermelho
        const lista = [
            mov({ id: 1, valor: 0.3 }),
            mov({ id: 2, tipo: TIPO.SAIDA, valor: 0.1 }),
            mov({ id: 3, tipo: TIPO.SAIDA, valor: 0.2 })
        ];
        const { saldo } = Regras.calcularResumo(lista);
        assert.equal(saldo, 0);
        assert.equal(saldo < 0, false);
    });

    it("saldo pode ser negativo", () => {
        const lista = [mov({ valor: 50 }), mov({ id: 2, tipo: TIPO.SAIDA, valor: 80 })];
        assert.equal(Regras.calcularResumo(lista).saldo, -30);
    });
});

describe("adicionar, editar e excluir", () => {
    it("adicionar devolve uma lista nova, com valor arredondado e textos sem espaços nas pontas", () => {
        const original = [];
        const nova = Regras.adicionarMovimentacao(
            original,
            mov({ valor: 10.456, descricao: "  Café  ", categoria: " Alimentação ", subcategoria: " Padaria " }),
            99
        );
        assert.equal(original.length, 0, "a lista original não pode ser alterada");
        assert.deepEqual(nova[0], {
            ...mov({ valor: 10.46, descricao: "Café", categoria: "Alimentação", subcategoria: "Padaria" }),
            id: 99
        });
    });

    it("editar troca só a movimentação certa e registra dataModificacao", () => {
        const lista = [mov({ id: 1 }), mov({ id: 2, descricao: "Mercado" })];
        const nova = Regras.editarMovimentacao(lista, 2, mov({ descricao: "Feira" }), "2026-10-28T12:00:00.000Z");
        assert.equal(nova[0], lista[0], "a movimentação 1 não muda");
        assert.equal(nova[1].id, 2, "o id é mantido");
        assert.equal(nova[1].descricao, "Feira");
        assert.equal(nova[1].dataModificacao, "2026-10-28T12:00:00.000Z");
        assert.equal(lista[1].descricao, "Mercado", "a lista original não pode ser alterada");
    });

    it("excluir remove só a movimentação com o id informado", () => {
        const lista = [mov({ id: 1 }), mov({ id: 2 }), mov({ id: 3 })];
        assert.deepEqual(ids(Regras.excluirMovimentacao(lista, 2)), [1, 3]);
    });
});

describe("categorias e subcategorias", () => {
    const lista = [
        mov({ id: 1, categoria: "Alimentação", subcategoria: "Mercado" }),
        mov({ id: 2, categoria: "Alimentação", subcategoria: "Delivery" }),
        mov({ id: 3, categoria: "Alimentação", subcategoria: "" }),
        mov({ id: 4, categoria: "Transporte", subcategoria: "Uber" }),
        mov({ id: 5, categoria: "", subcategoria: "" })
    ];

    it("normaliza movimentações antigas, sem os campos de categoria", () => {
        const antiga = { id: 1, tipo: TIPO.SAIDA, valor: 10, data: "2026-09-01", descricao: "Antiga" };
        assert.deepEqual(Regras.normalizarMovimentacao(antiga), { ...antiga, categoria: "", subcategoria: "" });
    });

    it("normalizar descarta subcategoria sem categoria", () => {
        assert.equal(Regras.normalizarMovimentacao(mov({ categoria: "", subcategoria: "Solta" })).subcategoria, "");
    });

    it("lista as categorias usadas, sem repetir e em ordem alfabética", () => {
        assert.deepEqual(Regras.listarCategorias(lista), ["Alimentação", "Transporte"]);
    });

    it("lista as subcategorias de uma categoria", () => {
        assert.deepEqual(Regras.listarSubcategorias(lista, "Alimentação"), ["Delivery", "Mercado"]);
        assert.deepEqual(Regras.listarSubcategorias(lista, "Lazer"), []);
        assert.deepEqual(Regras.listarSubcategorias(lista, ""), []);
    });

    it("sabe se existem movimentações sem categoria ou sem subcategoria", () => {
        assert.equal(Regras.existeSemCategoria(lista), true);
        assert.equal(Regras.existeSemSubcategoria(lista, "Alimentação"), true);
        assert.equal(Regras.existeSemSubcategoria(lista, "Transporte"), false);
    });

    it("reaproveita a grafia já existente, ignorando maiúsculas e minúsculas", () => {
        const dados = Regras.aplicarGrafiaExistente(lista, { categoria: "alimentação", subcategoria: "MERCADO" });
        assert.equal(dados.categoria, "Alimentação");
        assert.equal(dados.subcategoria, "Mercado");
    });

    it("mantém o texto digitado quando a categoria é nova", () => {
        const dados = Regras.aplicarGrafiaExistente(lista, { categoria: "Lazer", subcategoria: "Cinema" });
        assert.equal(dados.categoria, "Lazer");
        assert.equal(dados.subcategoria, "Cinema");
    });

    it("monta o rótulo da etiqueta do histórico", () => {
        assert.equal(Regras.rotuloCategoria(lista[0]), "Alimentação › Mercado");
        assert.equal(Regras.rotuloCategoria(lista[2]), "Alimentação");
        assert.equal(Regras.rotuloCategoria(lista[4]), "");
    });
});

describe("histórico: ordenação e filtros", () => {
    const lista = [
        mov({ id: 1, data: "2026-09-30", tipo: TIPO.ENTRADA, categoria: "Trabalho", subcategoria: "Salário" }),
        mov({ id: 2, data: "2026-10-05", tipo: TIPO.SAIDA, categoria: "Alimentação", subcategoria: "Mercado" }),
        mov({ id: 3, data: "2026-10-05", tipo: TIPO.SAIDA, categoria: "Alimentação", subcategoria: "" }),
        mov({ id: 4, data: "2026-10-20", tipo: TIPO.SAIDA, categoria: "Transporte", subcategoria: "Uber" }),
        mov({ id: 5, data: "2026-10-21", tipo: TIPO.ENTRADA, categoria: "", subcategoria: "" })
    ];
    const filtrar = (filtros) => ids(Regras.filtrarMovimentacoes(lista, filtros));

    it("ordena da data mais recente para a mais antiga; no mesmo dia, a registrada por último primeiro", () => {
        assert.deepEqual(ids(Regras.ordenarHistorico(lista)), [5, 4, 3, 2, 1]);
    });

    it("ordenar não altera a lista original", () => {
        Regras.ordenarHistorico(lista);
        assert.deepEqual(ids(lista), [1, 2, 3, 4, 5]);
    });

    it("sem filtros, mostra tudo", () => {
        assert.deepEqual(filtrar({}), [1, 2, 3, 4, 5]);
    });

    it("filtra por tipo e por mês", () => {
        assert.deepEqual(filtrar({ tipo: TIPO.SAIDA }), [2, 3, 4]);
        assert.deepEqual(filtrar({ mes: "2026-10" }), [2, 3, 4, 5]);
    });

    it("filtra por categoria e por 'Sem categoria'", () => {
        assert.deepEqual(filtrar({ categoria: "Alimentação" }), [2, 3]);
        assert.deepEqual(filtrar({ categoria: FILTRO_SEM }), [5]);
    });

    it("filtra por subcategoria e por 'Sem subcategoria' dentro da categoria", () => {
        assert.deepEqual(filtrar({ categoria: "Alimentação", subcategoria: "Mercado" }), [2]);
        assert.deepEqual(filtrar({ categoria: "Alimentação", subcategoria: FILTRO_SEM }), [3]);
    });

    it("ignora a subcategoria quando nenhuma categoria específica foi escolhida", () => {
        assert.deepEqual(filtrar({ subcategoria: "Mercado" }), [1, 2, 3, 4, 5]);
    });

    it("combina filtros", () => {
        assert.deepEqual(filtrar({ tipo: TIPO.SAIDA, mes: "2026-10", categoria: "Transporte" }), [4]);
    });

    it("filtroAtivo só é verdadeiro quando algum filtro foi escolhido", () => {
        assert.equal(Regras.filtroAtivo({}), false);
        assert.equal(Regras.filtroAtivo({ tipo: TIPO.SAIDA }), true);
        assert.equal(Regras.filtroAtivo({ categoria: "Alimentação" }), true);
    });

    it("lista os meses em uso, do mais recente para o mais antigo", () => {
        assert.deepEqual(Regras.listarMeses(lista), ["2026-10", "2026-09"]);
    });
});

describe("importação", () => {
    const gerarId = (indice) => 1000 + indice;

    it("recusa arquivo que não tem lista de movimentações", () => {
        assert.ok(Regras.lerMovimentacoesImportadas({ outra: "coisa" }, gerarId).erro);
        assert.ok(Regras.lerMovimentacoesImportadas(null, gerarId).erro);
    });

    it("importa o formato exportado pela Coinn e ignora itens inválidos", () => {
        const conteudo = Regras.montarExportacao([
            mov({ id: 1 }),
            mov({ id: 2, valor: -5 }),
            mov({ id: 3, data: "2026-13-45" }),
            mov({ id: 4, categoria: "a".repeat(21) })
        ], "2026-10-28T12:00:00.000Z");

        const resultado = Regras.lerMovimentacoesImportadas(conteudo, gerarId);
        assert.deepEqual(ids(resultado.lista), [1]);
        assert.equal(resultado.ignoradas, 3);
    });

    it("aceita arquivos antigos (v1, sem categoria) como 'sem categoria'", () => {
        const antigo = { app: "coinn", versao: 1, movimentacoes: [mov({ categoria: undefined, subcategoria: undefined })] };
        const { lista } = Regras.lerMovimentacoesImportadas(antigo, gerarId);
        assert.equal(lista[0].categoria, "");
        assert.equal(lista[0].subcategoria, "");
    });

    it("descarta só a subcategoria quando ela vem sem categoria", () => {
        const { lista, ignoradas } = Regras.lerMovimentacoesImportadas(
            [mov({ categoria: "", subcategoria: "Solta" })],
            gerarId
        );
        assert.equal(ignoradas, 0);
        assert.equal(lista[0].subcategoria, "");
    });

    it("cria um id novo quando o id falta ou está repetido", () => {
        const resultado = Regras.lerMovimentacoesImportadas(
            [mov({ id: 7 }), mov({ id: 7 }), mov({ id: undefined })],
            gerarId
        );
        assert.deepEqual(ids(resultado.lista), [7, 1001, 1002]);
    });
});

describe("formatação", () => {
    it("formata moeda em real", () => {
        // O Intl usa um espaço especial (não quebrável) entre "R$" e o número
        assert.equal(Regras.formatarMoeda(2400.2).replace(/\s/g, " "), "R$ 2.400,20");
    });

    it("formata data e mês em português", () => {
        assert.equal(Regras.formatarData("2026-10-14"), "14/10/2026");
        assert.equal(Regras.formatarMes("2026-10"), "Outubro de 2026");
    });

    it("dataISO usa o dia local, sem pular para o dia anterior", () => {
        assert.equal(Regras.dataISO(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
    });
});

describe("movimentações futuras e saldo previsto", () => {
    const HOJE = "2026-11-03";
    const lista = [
        mov({ id: 1, tipo: TIPO.ENTRADA, valor: 3000, data: "2026-11-01" }),
        mov({ id: 2, tipo: TIPO.SAIDA, valor: 200, data: HOJE }),            // hoje conta no saldo atual
        mov({ id: 3, tipo: TIPO.SAIDA, valor: 500, data: "2026-11-04" }),    // amanhã: futura
        mov({ id: 4, tipo: TIPO.ENTRADA, valor: 100, data: "2027-01-10" })   // futura em outro ano
    ];

    it("futura é só a data depois de hoje", () => {
        assert.equal(Regras.ehFutura(mov({ data: "2026-11-04" }), HOJE), true);
        assert.equal(Regras.ehFutura(mov({ data: HOJE }), HOJE), false);
        assert.equal(Regras.ehFutura(mov({ data: "2026-10-31" }), HOJE), false);
    });

    it("saldo atual ignora as futuras; o previsto inclui", () => {
        const resumo = Regras.calcularResumoGeral(lista, HOJE);
        assert.equal(resumo.entradas, 3000);
        assert.equal(resumo.saidas, 200);
        assert.equal(resumo.saldo, 2800);
        assert.equal(resumo.saldoPrevisto, 2400);
        assert.equal(resumo.quantidadeFuturas, 2);
    });

    it("sem futuras, o previsto é igual ao atual", () => {
        const resumo = Regras.calcularResumoGeral(lista.slice(0, 2), HOJE);
        assert.equal(resumo.saldoPrevisto, resumo.saldo);
        assert.equal(resumo.quantidadeFuturas, 0);
    });

    it("lista vazia dá tudo zero", () => {
        assert.deepEqual(Regras.calcularResumoGeral([], HOJE), {
            entradas: 0, saidas: 0, saldo: 0, saldoPrevisto: 0, quantidadeFuturas: 0
        });
    });
});

describe("visão mensal: datas", () => {
    it("último dia do mês, inclusive fevereiro de ano bissexto", () => {
        assert.equal(Regras.ultimoDiaDoMes("2026-11"), "2026-11-30");
        assert.equal(Regras.ultimoDiaDoMes("2026-12"), "2026-12-31");
        assert.equal(Regras.ultimoDiaDoMes("2026-02"), "2026-02-28");
        assert.equal(Regras.ultimoDiaDoMes("2028-02"), "2028-02-29");
    });

    it("anda meses para frente e para trás virando o ano", () => {
        assert.equal(Regras.deslocarMes("2026-12", 1), "2027-01");
        assert.equal(Regras.deslocarMes("2026-01", -1), "2025-12");
        assert.equal(Regras.deslocarMes("2026-11", 14), "2028-01");
        assert.equal(Regras.deslocarMes("2026-11", 0), "2026-11");
    });

    it("diz se o mês é passado, atual ou futuro", () => {
        const { SITUACAO_MES } = Regras;
        assert.equal(Regras.situacaoDoMes("2026-10", "2026-11-03"), SITUACAO_MES.PASSADO);
        assert.equal(Regras.situacaoDoMes("2026-11", "2026-11-03"), SITUACAO_MES.ATUAL);
        assert.equal(Regras.situacaoDoMes("2026-12", "2026-11-03"), SITUACAO_MES.FUTURO);
        assert.equal(Regras.situacaoDoMes("2025-12", "2026-01-01"), SITUACAO_MES.PASSADO);
    });
});

describe("calcularResumoMensal", () => {
    const HOJE = "2026-11-03";
    const lista = [
        mov({ id: 1, tipo: TIPO.ENTRADA, valor: 1000, data: "2026-10-05" }),
        mov({ id: 2, tipo: TIPO.SAIDA, valor: 300, data: "2026-10-31" }),
        mov({ id: 3, tipo: TIPO.ENTRADA, valor: 2000, data: "2026-11-01" }),
        mov({ id: 4, tipo: TIPO.SAIDA, valor: 450.5, data: "2026-11-30" }),  // futura, ainda em novembro
        mov({ id: 5, tipo: TIPO.SAIDA, valor: 99.9, data: "2026-12-01" })    // já é dezembro
    ];

    it("soma só as movimentações do mês, inclusive as futuras", () => {
        const nov = Regras.calcularResumoMensal(lista, "2026-11", HOJE);
        assert.equal(nov.entradas, 2000);
        assert.equal(nov.saidas, 450.5);
        assert.equal(nov.resultado, 1549.5);
        assert.equal(nov.quantidade, 2);
        assert.equal(nov.quantidadeFuturas, 1);
    });

    it("saldo inicial é o acumulado antes do dia 1, e o final vai até o último dia", () => {
        const nov = Regras.calcularResumoMensal(lista, "2026-11", HOJE);
        assert.equal(nov.saldoInicial, 700);          // outubro: 1000 - 300
        assert.equal(nov.saldoFinal, 2249.5);         // 700 + 1549,50 (não inclui 01/12)
        assert.equal(nov.saldoFinal, nov.saldoInicial + nov.resultado);
    });

    it("mês passado não tem futuras e mês sem movimentação mantém o saldo", () => {
        const out = Regras.calcularResumoMensal(lista, "2026-10", HOJE);
        assert.equal(out.quantidadeFuturas, 0);
        assert.equal(out.situacao, Regras.SITUACAO_MES.PASSADO);

        const jan = Regras.calcularResumoMensal(lista, "2027-01", HOJE);
        assert.equal(jan.quantidade, 0);
        assert.equal(jan.resultado, 0);
        assert.equal(jan.saldoInicial, jan.saldoFinal);
        assert.equal(jan.situacao, Regras.SITUACAO_MES.FUTURO);
    });

    it("soma centavos sem erro de ponto flutuante", () => {
        const centavos = [
            mov({ id: 1, tipo: TIPO.ENTRADA, valor: 0.3, data: "2026-11-01" }),
            mov({ id: 2, tipo: TIPO.SAIDA, valor: 0.1, data: "2026-11-02" }),
            mov({ id: 3, tipo: TIPO.SAIDA, valor: 0.2, data: "2026-11-20" })
        ];
        const nov = Regras.calcularResumoMensal(centavos, "2026-11", HOJE);
        assert.equal(nov.resultado, 0);
        assert.equal(nov.saldoFinal, 0);
        assert.equal(Object.is(nov.saldoFinal, -0), false);
    });
});

describe("excluirMovimentacoes (seleção múltipla)", () => {
    const lista = [mov({ id: 1 }), mov({ id: 2 }), mov({ id: 3 }), mov({ id: 4 })];

    it("exclui só as selecionadas e não altera a lista original", () => {
        const nova = Regras.excluirMovimentacoes(lista, [2, 4]);
        assert.deepEqual(ids(nova), [1, 3]);
        assert.equal(lista.length, 4);
    });

    it("aceita um Set e ignora ids que não existem", () => {
        assert.deepEqual(ids(Regras.excluirMovimentacoes(lista, new Set([1, 99]))), [2, 3, 4]);
    });

    it("sem nada selecionado, não exclui nada", () => {
        assert.deepEqual(ids(Regras.excluirMovimentacoes(lista, [])), [1, 2, 3, 4]);
    });
});

describe("período (data inicial e final)", () => {
    const HOJE = "2026-11-03";
    const lista = [
        mov({ id: 1, tipo: TIPO.ENTRADA, valor: 1000, data: "2026-10-31" }),
        mov({ id: 2, tipo: TIPO.SAIDA, valor: 100, data: "2026-11-05" }),
        mov({ id: 3, tipo: TIPO.SAIDA, valor: 250.5, data: "2026-11-20" }),
        mov({ id: 4, tipo: TIPO.SAIDA, valor: 400, data: "2026-12-10" }),
        mov({ id: 5, tipo: TIPO.ENTRADA, valor: 50, data: "2026-12-11" })
    ];

    it("valida o período", () => {
        assert.equal(Regras.validarPeriodo("2026-11-05", "2026-12-10"), null);
        assert.equal(Regras.validarPeriodo("2026-11-05", "2026-11-05"), null);   // um dia só
        assert.match(Regras.validarPeriodo("2026-12-10", "2026-11-05"), /antes da inicial/);
        assert.match(Regras.validarPeriodo("", "2026-11-05"), /data inicial e a final/);
        assert.match(Regras.validarPeriodo("2026-11-05", "2026-02-31"), /data inicial e a final/);
    });

    it("filtra incluindo o primeiro e o último dia, mesmo atravessando meses", () => {
        const filtradas = Regras.filtrarMovimentacoes(lista, { dataInicio: "2026-11-05", dataFim: "2026-12-10" });
        assert.deepEqual(ids(filtradas), [2, 3, 4]);
    });

    it("filtro de um dia só", () => {
        const filtradas = Regras.filtrarMovimentacoes(lista, { dataInicio: "2026-11-20", dataFim: "2026-11-20" });
        assert.deepEqual(ids(filtradas), [3]);
    });

    it("período conta como filtro ativo", () => {
        assert.equal(Regras.filtroAtivo({ dataInicio: "2026-11-05", dataFim: "2026-12-10" }), true);
        assert.equal(Regras.filtroAtivo({}), false);
    });

    it("resumo do período: totais, saldo no início e no fim", () => {
        const r = Regras.calcularResumoPeriodo(lista, "2026-11-05", "2026-12-10", HOJE);
        assert.equal(r.entradas, 0);
        assert.equal(r.saidas, 750.5);
        assert.equal(r.resultado, -750.5);
        assert.equal(r.saldoInicial, 1000);
        assert.equal(r.saldoFinal, 249.5);
        assert.equal(r.quantidade, 3);
        assert.equal(r.quantidadeFuturas, 3);
        assert.equal(r.situacao, Regras.SITUACAO_MES.FUTURO);
    });

    it("situação do período em relação a hoje", () => {
        const { SITUACAO_MES } = Regras;
        assert.equal(Regras.calcularResumoPeriodo(lista, "2026-10-01", "2026-10-31", HOJE).situacao, SITUACAO_MES.PASSADO);
        assert.equal(Regras.calcularResumoPeriodo(lista, "2026-11-01", HOJE, HOJE).situacao, SITUACAO_MES.ATUAL);
        assert.equal(Regras.calcularResumoPeriodo(lista, "2026-11-04", "2026-11-30", HOJE).situacao, SITUACAO_MES.FUTURO);
    });
});

describe("períodos de meses (relatórios, exportar e importar)", () => {
    const lista = [
        mov({ id: 1, data: "2025-11-03" }),
        mov({ id: 2, data: "2026-02-10" }),
        mov({ id: 3, data: "2026-02-28" })
    ];

    it("resolve mês, vários meses, ano e tudo", () => {
        const hoje = "2026-11-10";
        assert.deepEqual(Regras.resolverPeriodo({ tipo: "mes", mes: "2026-02" }, lista, hoje), { inicio: "2026-02", fim: "2026-02" });
        assert.deepEqual(Regras.resolverPeriodo({ tipo: "meses", inicio: "2025-12", fim: "2026-03" }, lista, hoje), { inicio: "2025-12", fim: "2026-03" });
        assert.deepEqual(Regras.resolverPeriodo({ tipo: "ano", ano: "2025" }, lista, hoje), { inicio: "2025-01", fim: "2025-12" });
        assert.deepEqual(Regras.resolverPeriodo({ tipo: "tudo" }, lista, hoje), { inicio: "2025-11", fim: "2026-02" });
    });

    it("recusa escolhas inválidas", () => {
        const hoje = "2026-11-10";
        assert.match(Regras.resolverPeriodo({ tipo: "meses", inicio: "2026-05", fim: "2026-02" }, lista, hoje).erro, /antes do inicial/);
        assert.ok(Regras.resolverPeriodo({ tipo: "mes", mes: "2026-13" }, lista, hoje).erro);
        assert.ok(Regras.resolverPeriodo({ tipo: "ano", ano: "26" }, lista, hoje).erro);
        assert.ok(Regras.resolverPeriodo({ tipo: "tudo" }, [], hoje).erro);
        assert.ok(Regras.resolverPeriodo({ tipo: "semana" }, lista, hoje).erro);
    });

    it("lista meses do intervalo, atravessando o ano", () => {
        assert.deepEqual(Regras.listarMesesEntre("2025-11", "2026-02"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
        assert.deepEqual(Regras.listarMesesEntre("2026-05", "2026-05"), ["2026-05"]);
    });

    it("filtra pelo período, incluindo o primeiro e o último mês", () => {
        assert.deepEqual(ids(Regras.filtrarPorPeriodo(lista, { inicio: "2025-11", fim: "2026-01" })), [1]);
        assert.deepEqual(ids(Regras.filtrarPorPeriodo(lista, { inicio: "2026-02", fim: "2026-02" })), [2, 3]);
    });

    it("lista os anos com movimentação, do mais recente", () => {
        assert.deepEqual(Regras.listarAnos(lista), ["2026", "2025"]);
    });

    it("descreve o período por extenso e no nome do arquivo", () => {
        const casos = [
            [{ inicio: "2026-11", fim: "2026-11" }, "Novembro de 2026", "2026-11"],
            [{ inicio: "2026-01", fim: "2026-12" }, "Ano de 2026", "2026"],
            [{ inicio: "2026-01", fim: "2026-03" }, "Janeiro a Março de 2026", "2026-01_a_2026-03"],
            [{ inicio: "2025-11", fim: "2026-02" }, "Novembro de 2025 a Fevereiro de 2026", "2025-11_a_2026-02"]
        ];
        casos.forEach(([periodo, longo, arquivo]) => {
            assert.equal(Regras.descreverPeriodo(periodo), longo);
            assert.equal(Regras.nomeArquivoPeriodo(periodo), arquivo);
        });
    });
});

describe("exportação v3", () => {
    it("leva o período, um resumo e as movimentações", () => {
        const lista = [mov({ id: 1, valor: 100 }), mov({ id: 2, tipo: TIPO.SAIDA, valor: 30.5 })];
        const arquivo = Regras.montarExportacao(lista, "2026-11-10T12:00:00.000Z", { inicio: "2026-10", fim: "2026-10" });
        assert.equal(arquivo.app, "coinn");
        assert.equal(arquivo.versao, 3);
        assert.deepEqual(arquivo.periodo, { inicio: "2026-10", fim: "2026-10" });
        assert.deepEqual(arquivo.resumo, { quantidade: 2, entradas: 100, saidas: 30.5, resultado: 69.5 });
        assert.equal(arquivo.movimentacoes, lista);
        assert.equal(Regras.montarExportacao(lista, "x").periodo, null);
    });

    it("a importação devolve o período informado no arquivo", () => {
        const arquivo = JSON.parse(JSON.stringify(Regras.montarExportacao([mov({ id: 5 })], "x", { inicio: "2025-01", fim: "2025-12" })));
        const lido = Regras.lerMovimentacoesImportadas(arquivo, (i) => i);
        assert.deepEqual(lido.periodo, { inicio: "2025-01", fim: "2025-12" });
        assert.equal(lido.lista.length, 1);
    });

    it("ignora período inválido no arquivo", () => {
        const arquivo = { periodo: { inicio: "2025-12", fim: "2025-01" }, movimentacoes: [mov()] };
        const lido = Regras.lerMovimentacoesImportadas(arquivo, (i) => i);
        assert.equal(lido.periodo, null);
        assert.equal(lido.lista.length, 1);
        assert.equal(Regras.lerMovimentacoesImportadas([mov()], (i) => i).periodo, null);
    });
});
