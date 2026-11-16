/*
 * relatorios.js
 * Cálculos dos relatórios: totais e médias do período, valores de cada mês (para os
 * gráficos de entradas, saídas e saldo), destaques e comparação com o período anterior.
 *
 * Igual ao regras.js: só funções puras (nada de tela nem de localStorage), testadas
 * em tests/relatorios.test.js. Usa as regras do regras.js (somas em centavos, meses...).
 *
 * Ajustes de saldo (criados ao exportar e remover um período) não são entradas nem
 * saídas de verdade: ficam fora dos totais e das médias, mas entram
 * no saldo, que continua igual ao do resto do app.
 */

/* exported Relatorios */
/* global Regras, require */
const Relatorios = (function () {
    "use strict";

    // No navegador, Regras é uma variável global; no Node (testes), vem do require()
    const R = typeof Regras !== "undefined" ? Regras : require("./regras.js");
    const { TIPO, SITUACAO_MES } = R;

    // ---------- Ajudantes ----------

    function saldoAte(lista, dataFinal) {
        return R.calcularResumo(lista.filter((mov) => mov.data <= dataFinal)).saldo;
    }

    function saldoAntesDe(lista, data) {
        return R.calcularResumo(lista.filter((mov) => mov.data < data)).saldo;
    }

    // Divisão que devolve null em vez de dividir por zero
    function proporcao(parte, total) {
        return total > 0 ? parte / total : null;
    }

    // Maior valor; no empate, a mais antiga (e depois a registrada primeiro)
    function maiorMovimentacao(lista) {
        return lista.reduce((maior, mov) => {
            if (!maior || mov.valor > maior.valor) return mov;
            if (mov.valor === maior.valor && (mov.data < maior.data || (mov.data === maior.data && mov.id < maior.id))) {
                return mov;
            }
            return maior;
        }, null);
    }

    // Mês com o maior (ou menor) valor de um campo, entre os meses com movimentação
    function mesExtremo(porMes, campo, maior = true) {
        return porMes
            .filter((mes) => mes.quantidade > 0)
            .reduce((escolhido, mes) => {
                if (!escolhido) return mes;
                return (maior ? mes[campo] > escolhido[campo] : mes[campo] < escolhido[campo]) ? mes : escolhido;
            }, null);
    }

    // ---------- Valores de cada mês ----------

    // Um item por mês do período (inclusive meses sem movimentação):
    // { mes, entradas, saidas, resultado, ajustes, saldoFinal, quantidade, situacao }
    function calcularMeses(lista, periodo, hoje) {
        return R.listarMesesEntre(periodo.inicio, periodo.fim).map((mes) => {
            const doMes = lista.filter((mov) => mov.data.startsWith(mes));
            const normais = doMes.filter((mov) => !R.ehAjuste(mov));
            const { entradas, saidas, saldo } = R.calcularResumo(normais);
            return {
                mes,
                entradas,
                saidas,
                resultado: saldo,
                ajustes: R.calcularResumo(doMes.filter(R.ehAjuste)).saldo,
                saldoFinal: saldoAte(lista, R.ultimoDiaDoMes(mes)),
                quantidade: normais.length,
                situacao: R.situacaoDoMes(mes, hoje)
            };
        });
    }

    // ---------- Comparação com o período anterior ----------

    // O mesmo número de meses, logo antes do período: Jan–Jun 2026 compara com Jul–Dez 2025.
    // null se o período anterior não tiver nenhuma movimentação.
    function compararComAnterior(lista, periodo) {
        const quantidadeMeses = R.listarMesesEntre(periodo.inicio, periodo.fim).length;
        const anterior = {
            inicio: R.deslocarMes(periodo.inicio, -quantidadeMeses),
            fim: R.deslocarMes(periodo.inicio, -1)
        };
        const doAnterior = R.filtrarPorPeriodo(lista, anterior).filter((mov) => !R.ehAjuste(mov));
        if (doAnterior.length === 0) return null;

        const { entradas, saidas, saldo } = R.calcularResumo(doAnterior);
        return { periodo: anterior, entradas, saidas, resultado: saldo };
    }

    // Variação em relação ao anterior (0.12 = 12% a mais); null se não der para comparar
    function variacao(atual, anterior) {
        if (anterior === null || anterior === undefined || anterior === 0) return null;
        return (atual - anterior) / Math.abs(anterior);
    }

    // ---------- Relatório completo ----------

    // lista: todas as movimentações | periodo: { inicio, fim } ("AAAA-MM") | hoje: "AAAA-MM-DD"
    function gerarRelatorio(lista, periodo, hoje) {
        const doPeriodo = R.filtrarPorPeriodo(lista, periodo);
        const normais = doPeriodo.filter((mov) => !R.ehAjuste(mov));
        const entradasLista = normais.filter((mov) => mov.tipo === TIPO.ENTRADA);
        const saidasLista = normais.filter((mov) => mov.tipo === TIPO.SAIDA);

        const meses = calcularMeses(lista, periodo, hoje);
        const totais = R.calcularResumo(normais);
        const saldoInicial = saldoAntesDe(lista, `${periodo.inicio}-01`);
        const saldoFinal = meses[meses.length - 1].saldoFinal;
        const anterior = compararComAnterior(lista, periodo);

        let situacao = SITUACAO_MES.ATUAL;
        if (periodo.fim < hoje.slice(0, 7)) situacao = SITUACAO_MES.PASSADO;
        else if (periodo.inicio > hoje.slice(0, 7)) situacao = SITUACAO_MES.FUTURO;

        return {
            periodo: { inicio: periodo.inicio, fim: periodo.fim },
            descricao: R.descreverPeriodo(periodo),
            situacao,
            vazio: doPeriodo.length === 0,
            meses,
            totais: {
                entradas: totais.entradas,
                saidas: totais.saidas,
                resultado: totais.saldo,
                ajustes: R.calcularResumo(doPeriodo.filter(R.ehAjuste)).saldo,
                saldoInicial,
                saldoFinal
            },
            contagem: {
                movimentacoes: normais.length,
                entradas: entradasLista.length,
                saidas: saidasLista.length,
                futuras: normais.filter((mov) => R.ehFutura(mov, hoje)).length,
                ajustes: doPeriodo.length - normais.length,
                meses: meses.length,
                categorias: R.listarCategorias(normais).length
            },
            medias: {
                entradasPorMes: R.arredondarCentavos(totais.entradas / meses.length),
                saidasPorMes: R.arredondarCentavos(totais.saidas / meses.length),
                valorPorSaida: saidasLista.length ? R.arredondarCentavos(totais.saidas / saidasLista.length) : null
            },
            // Quanto das entradas sobrou (0.25 = guardou 25%); null sem entradas
            taxaEconomia: proporcao(totais.saldo, totais.entradas),
            destaques: {
                maiorEntrada: maiorMovimentacao(entradasLista),
                maiorSaida: maiorMovimentacao(saidasLista),
                mesMaisEntradas: mesExtremo(meses.filter((m) => m.entradas > 0), "entradas"),
                mesMaisSaidas: mesExtremo(meses.filter((m) => m.saidas > 0), "saidas"),
                melhorMes: mesExtremo(meses, "resultado", true),
                piorMes: mesExtremo(meses, "resultado", false)
            },
            anterior: anterior && {
                ...anterior,
                descricao: R.descreverPeriodo(anterior.periodo),
                variacaoEntradas: variacao(totais.entradas, anterior.entradas),
                variacaoSaidas: variacao(totais.saidas, anterior.saidas)
            }
        };
    }

    return Object.freeze({
        calcularMeses,
        compararComAnterior,
        variacao,
        gerarRelatorio
    });
})();

if (typeof module !== "undefined" && module.exports) {
    module.exports = Relatorios;
}
