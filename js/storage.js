/*
 * storage.js
 * Camada de armazenamento: lê e grava os dados no localStorage.
 * Nenhuma outra parte do código acessa o localStorage diretamente.
 * Decisão registrada na ADR 01 (aplicação client-side com localStorage).
 *
 * Padrão de projeto: Repository. O objeto "Armazenamento" é a única porta de
 * entrada para os dados. Se um dia o Coinn trocar o localStorage por outra
 * forma de guardar (IndexedDB, um servidor...), só este arquivo muda.
 *
 * (O nome não é "Storage" porque esse nome já existe no navegador.)
 */

/* exported Armazenamento */
const Armazenamento = (function () {
    "use strict";

    // Chave única do projeto, para não colidir com outros apps no mesmo navegador
    const CHAVE_MOVIMENTACOES = "coinn.movimentacoes";

    // Preferência do botão "olho" (mostrar/ocultar valores)
    const CHAVE_VALORES_VISIVEIS = "coinn.valoresVisiveis";

    // Retorna a lista de movimentações salva, ou uma lista vazia
    function carregarMovimentacoes() {
        try {
            const dados = localStorage.getItem(CHAVE_MOVIMENTACOES);
            if (!dados) return [];

            const lista = JSON.parse(dados);
            // Se o conteúdo salvo não for uma lista, ignora para não quebrar o app
            return Array.isArray(lista) ? lista : [];
        } catch (erro) {
            console.error("Coinn: não foi possível ler os dados salvos.", erro);
            return [];
        }
    }

    // Grava a lista inteira de movimentações; retorna true se deu certo
    function salvarMovimentacoes(lista) {
        try {
            localStorage.setItem(CHAVE_MOVIMENTACOES, JSON.stringify(lista));
            return true;
        } catch (erro) {
            // Pode acontecer com o armazenamento cheio ou bloqueado pelo navegador
            console.error("Coinn: não foi possível salvar os dados.", erro);
            return false;
        }
    }

    // Apaga todas as movimentações salvas (usado pelo "Limpar tudo"); retorna true se deu certo.
    // A preferência de mostrar/ocultar valores continua salva.
    function removerTodasMovimentacoes() {
        try {
            localStorage.removeItem(CHAVE_MOVIMENTACOES);
            return true;
        } catch (erro) {
            console.error("Coinn: não foi possível apagar os dados.", erro);
            return false;
        }
    }

    // Retorna true se os valores devem aparecer (padrão), false se o usuário escolheu ocultar
    function carregarValoresVisiveis() {
        try {
            return localStorage.getItem(CHAVE_VALORES_VISIVEIS) !== "false";
        } catch {
            return true;
        }
    }

    function salvarValoresVisiveis(visiveis) {
        try {
            localStorage.setItem(CHAVE_VALORES_VISIVEIS, String(visiveis));
        } catch (erro) {
            // Não é grave: a preferência só não fica salva para a próxima visita
            console.error("Coinn: não foi possível salvar a preferência.", erro);
        }
    }

    return Object.freeze({
        carregarMovimentacoes,
        salvarMovimentacoes,
        removerTodasMovimentacoes,
        carregarValoresVisiveis,
        salvarValoresVisiveis
    });
})();

// Permite carregar o arquivo nos testes do Node com require()
if (typeof module !== "undefined" && module.exports) {
    module.exports = Armazenamento;
}
