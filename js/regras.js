/*
 * regras.js
 * Regras de negócio do Coinn: validação, cálculos, ordenação e formatação.
 *
 * Tudo aqui é função pura: recebe dados e devolve um resultado, sem mexer
 * na tela (DOM) nem no localStorage. Por isso essas regras podem ser testadas
 * sem precisar do navegador.
 *
 * Padrão de projeto: Module. Tudo fica dentro do objeto "Regras", em vez de
 * espalhar dezenas de funções soltas no escopo global do navegador.
 *
 * Modelo de dados de uma movimentação:
 *   { id, tipo ("entrada" | "saida"), valor, data ("AAAA-MM-DD"), descricao }
 */

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
        VALOR_MIN: 0.01,
        VALOR_MAX: 999999.99
    });

    // ---------- Valores, textos e datas ----------

    // Arredonda para 2 casas decimais (centavos)
    function arredondarCentavos(valor) {
        return Math.round(valor * 100) / 100;
    }

    // Texto sem espaços nas pontas; qualquer coisa que não seja texto vira ""
    function textoLimpo(valor) {
        return typeof valor === "string" ? valor.trim() : "";
    }

    // Confere o formato "AAAA-MM-DD"
    function dataValida(data) {
        return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data);
    }

    // ---------- Validação ----------

    // Retorna uma mensagem de erro, ou null se os dados estiverem válidos.
    // Usada pelo formulário de registro.
    function validarMovimentacao({ tipo, valor, data, descricao }) {
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
        return null;
    }

    // Monta só os campos que são guardados, já limpos
    function normalizarCampos({ tipo, valor, data, descricao }) {
        return {
            tipo,
            valor: arredondarCentavos(valor),
            data,
            descricao: textoLimpo(descricao)
        };
    }

    // ---------- #17 Registrar ----------

    // Devolve uma NOVA lista, sem alterar a original
    function adicionarMovimentacao(lista, dados, id) {
        return [...lista, { id, ...normalizarCampos(dados) }];
    }

    // ---------- #18 Saldo ----------

    // Total de entradas, total de saídas e saldo
    function calcularResumo(lista) {
        const somarPorTipo = (tipo) => lista
            .filter((mov) => mov.tipo === tipo)
            .reduce((total, mov) => total + mov.valor, 0);

        const entradas = somarPorTipo(TIPO.ENTRADA);
        const saidas = somarPorTipo(TIPO.SAIDA);
        return { entradas, saidas, saldo: entradas - saidas };
    }

    // ---------- #19 Histórico: ordenação ----------

    // Mais recente primeiro: ordena pela data e, no mesmo dia, pela ordem de registro (id)
    function ordenarHistorico(lista) {
        return [...lista].sort((a, b) => {
            if (a.data !== b.data) return a.data < b.data ? 1 : -1;
            return b.id - a.id;
        });
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
        arredondarCentavos,
        dataValida,
        validarMovimentacao,
        adicionarMovimentacao,
        calcularResumo,
        ordenarHistorico,
        formatarMoeda,
        formatarData,
        dataISO
    });
})();
