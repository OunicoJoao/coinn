/*
 * relatorios.test.js
 * Testes dos cálculos dos relatórios (js/relatorios.js).
 * Rodar com: npm test   (ou: node --test)
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Regras = require("../js/regras.js");
const Relatorios = require("../js/relatorios.js");

const { TIPO, SITUACAO_MES } = Regras;
const HOJE = "2026-11-10";

let proximoId = 1;
function mov(tipo, valor, data, descricao = "Teste", categoria = "", subcategoria = "") {
    return { id: proximoId++, tipo, valor, data, descricao, categoria, subcategoria };
}

// Saldo antes do período: +1000. Período de Set a Dez/2026 (dezembro é futuro em 10/11/2026).
const lista = [
    mov(TIPO.ENTRADA, 1000, "2026-08-05", "Salário", "Trabalho"),
    mov(TIPO.ENTRADA, 3000, "2026-09-05", "Salário", "Trabalho", "Salário"),
    mov(TIPO.SAIDA, 1200, "2026-09-10", "Aluguel", "Moradia", "Aluguel"),
    mov(TIPO.SAIDA, 300.1, "2026-09-12", "Mercado", "Alimentação", "Mercado"),
    mov(TIPO.ENTRADA, 3000, "2026-10-05", "Salário", "Trabalho", "Salário"),
    mov(TIPO.ENTRADA, 500, "2026-10-20", "Freela", "Trabalho", "Extra"),
    mov(TIPO.SAIDA, 1200, "2026-10-10", "Aluguel", "Moradia", "Aluguel"),
    mov(TIPO.SAIDA, 2000.2, "2026-10-25", "Viagem", "Lazer"),
    mov(TIPO.SAIDA, 99.7, "2026-11-08", "Presente"),
    mov(TIPO.SAIDA, 1200, "2026-12-10", "Aluguel", "Moradia", "Aluguel")
];
const periodo = { inicio: "2026-09", fim: "2026-12" };

describe("gerarRelatorio", () => {
    const relatorio = Relatorios.gerarRelatorio(lista, periodo, HOJE);

    it("totais do período, com saldo inicial e final", () => {
        assert.deepEqual(relatorio.totais, {
            entradas: 6500,
            saidas: 6000,
            resultado: 500,
            ajustes: 0,
            saldoInicial: 1000,
            saldoFinal: 1500
        });
        assert.equal(relatorio.descricao, "Setembro a Dezembro de 2026");
        assert.equal(relatorio.situacao, SITUACAO_MES.ATUAL);
        assert.equal(relatorio.vazio, false);
    });

    it("um item por mês, inclusive meses sem movimentação, com o saldo no fim de cada um", () => {
        assert.deepEqual(relatorio.meses.map((m) => m.mes), ["2026-09", "2026-10", "2026-11", "2026-12"]);
        assert.deepEqual(relatorio.meses.map((m) => m.entradas), [3000, 3500, 0, 0]);
        assert.deepEqual(relatorio.meses.map((m) => m.saidas), [1500.1, 3200.2, 99.7, 1200]);
        assert.deepEqual(relatorio.meses.map((m) => m.saldoFinal), [2499.9, 2799.7, 2700, 1500]);
        assert.deepEqual(relatorio.meses.map((m) => m.situacao),
            [SITUACAO_MES.PASSADO, SITUACAO_MES.PASSADO, SITUACAO_MES.ATUAL, SITUACAO_MES.FUTURO]);
        // fim de cada mês = fim do anterior + resultado do mês
        relatorio.meses.reduce((anterior, mes) => {
            assert.equal(Regras.arredondarCentavos(anterior + mes.resultado), mes.saldoFinal);
            return mes.saldoFinal;
        }, relatorio.totais.saldoInicial);
    });

    it("contagens, médias por mês e taxa de economia", () => {
        assert.deepEqual(relatorio.contagem, {
            movimentacoes: 9, entradas: 3, saidas: 6, futuras: 1, ajustes: 0, meses: 4, categorias: 4
        });
        assert.deepEqual(relatorio.medias, { entradasPorMes: 1625, saidasPorMes: 1500, valorPorSaida: 1000 });
        assert.equal(relatorio.taxaEconomia, 500 / 6500);
    });

    it("destaques: maior entrada e saída, meses extremos", () => {
        const { destaques } = relatorio;
        assert.equal(destaques.maiorEntrada.data, "2026-09-05"); // empate em 3000: a mais antiga
        assert.equal(destaques.maiorSaida.descricao, "Viagem");
        assert.equal(destaques.mesMaisEntradas.mes, "2026-10");
        assert.equal(destaques.mesMaisSaidas.mes, "2026-10");
        assert.equal(destaques.melhorMes.mes, "2026-09");
        assert.equal(destaques.piorMes.mes, "2026-12");
    });

    it("compara com o mesmo número de meses logo antes", () => {
        const anterior = Relatorios.gerarRelatorio(lista, { inicio: "2026-09", fim: "2026-09" }, HOJE).anterior;
        assert.deepEqual(anterior.periodo, { inicio: "2026-08", fim: "2026-08" });
        assert.equal(anterior.entradas, 1000);
        assert.equal(anterior.variacaoEntradas, 2);   // 3000 contra 1000 = +200%
        assert.equal(anterior.variacaoSaidas, null);  // não houve saídas para comparar
        // Set–Dez/2026 compara com Mai–Ago/2026, que só tem a entrada de agosto
        assert.deepEqual(relatorio.anterior.periodo, { inicio: "2026-05", fim: "2026-08" });
        assert.equal(relatorio.anterior.descricao, "Maio a Agosto de 2026");
        assert.equal(relatorio.anterior.variacaoEntradas, 5.5);
        // Sem nada no período anterior, não há comparação
        assert.equal(Relatorios.gerarRelatorio(lista, { inicio: "2026-08", fim: "2026-08" }, HOJE).anterior, null);
    });

    it("período sem movimentação fica vazio, mas com o saldo acumulado", () => {
        const vazio = Relatorios.gerarRelatorio(lista, { inicio: "2027-01", fim: "2027-02" }, HOJE);
        assert.equal(vazio.vazio, true);
        assert.equal(vazio.totais.saldoInicial, 1500);
        assert.equal(vazio.totais.saldoFinal, 1500);
        assert.equal(vazio.taxaEconomia, null);
        assert.equal(vazio.medias.valorPorSaida, null);
        assert.equal(vazio.destaques.maiorSaida, null);
        assert.equal(vazio.situacao, SITUACAO_MES.FUTURO);
    });
});

describe("ajustes de saldo nos relatórios", () => {
    it("não contam como entrada/saída, mas entram no saldo", () => {
        const comAjuste = [
            mov(TIPO.SAIDA, 100, "2026-01-10", "Café"),
            { ...mov(TIPO.ENTRADA, 900, "2025-12-31", "Saldo de 2025", "Ajuste de saldo"), ajuste: { inicio: "2025-01", fim: "2025-12", quantidade: 10 } }
        ];
        const ano2025 = Relatorios.gerarRelatorio(comAjuste, { inicio: "2025-01", fim: "2025-12" }, HOJE);
        assert.equal(ano2025.totais.entradas, 0);
        assert.equal(ano2025.totais.ajustes, 900);
        assert.equal(ano2025.totais.saldoFinal, 900);
        assert.equal(ano2025.contagem.ajustes, 1);
        assert.equal(ano2025.meses[11].ajustes, 900);

        const ano2026 = Relatorios.gerarRelatorio(comAjuste, { inicio: "2026-01", fim: "2026-12" }, HOJE);
        assert.equal(ano2026.totais.saldoInicial, 900);
        assert.equal(ano2026.totais.saldoFinal, 800);
    });
});

describe("variacao", () => {
    it("calcula a variação e devolve null sem base de comparação", () => {
        assert.equal(Relatorios.variacao(150, 100), 0.5);
        assert.equal(Relatorios.variacao(50, 100), -0.5);
        assert.equal(Relatorios.variacao(10, 0), null);
        assert.equal(Relatorios.variacao(10, null), null);
    });
});
