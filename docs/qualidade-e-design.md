# Qualidade e Design do Código (Sprint 4)

Esta página explica como o código do Coinn foi organizado para ser fácil de manter, testar e evoluir, e quais ganhos de qualidade a Sprint 4 trouxe.

## 1. Antes e depois

| | MVP (Sprint 3) | MVP ampliado (Sprint 4) |
|---|---|---|
| Regras de negócio | Misturadas com o código da tela, em `app.js` | Separadas em `regras.js`, como funções puras |
| Testes automatizados | Nenhum | 77 testes (66 de regras e 11 de armazenamento) |
| Verificação de padrão | Nenhuma | ESLint com regras recomendadas + regras do projeto |
| Pipeline | Verifica arquivos e sintaxe | Arquivos, sintaxe, ESLint e testes, com resultados na aba Tests |
| Defeitos conhecidos | 2 (veja a seção 5) | 0 |

## 2. Responsabilidade única (o "S" do SOLID)

Cada arquivo de `js/` tem um único motivo para mudar:

| Arquivo | Responsabilidade | Muda quando... |
|---|---|---|
| `regras.js` | Regras de negócio: validar, calcular saldo, filtrar, ordenar, importar | uma regra do produto muda (ex.: limite de valor) |
| `storage.js` | Ler e gravar dados no localStorage | a forma de guardar os dados muda |
| `app.js` | Tela: ler o formulário, desenhar a lista, reagir a cliques | o visual ou a interação muda |

Exemplo: o cálculo do saldo não conhece a tela. Ele recebe uma lista e devolve números:

```js
// regras.js
function calcularResumo(lista) { ... return { entradas, saidas, saldo }; }

// app.js: só mostra o resultado
const { entradas, saidas, saldo } = Regras.calcularResumo(movimentacoes);
saldoEl.textContent = exibirValor(saldo);
```

Por isso, `regras.js` pode ser testado no Node, sem navegador.

## 3. Padrões de projeto

### Module

`regras.js` e `storage.js` criam, cada um, um único objeto (`Regras` e `Armazenamento`) com uma função que se executa na hora (IIFE). O que é interno fica escondido, e só o que está no `return` pode ser usado por outros arquivos:

```js
const Regras = (function () {
    function completarFiltros(filtros) { ... }   // interna, ninguém de fora usa
    function filtrarMovimentacoes(lista, filtros) { ... }
    return Object.freeze({ filtrarMovimentacoes, ... });
})();
```

Com isso, os nomes deixam de ficar soltos no escopo global (antes eram 42 funções soltas no escopo global; agora `regras.js` e `storage.js` expõem um único nome cada), e o `Object.freeze` impede que algum código altere o módulo sem querer.

### Repository

`Armazenamento` (`storage.js`) é a **única porta de acesso aos dados**. Nenhum outro arquivo usa o `localStorage`. Se um dia o Coinn trocar o localStorage por IndexedDB ou por um servidor, só `storage.js` muda; `app.js` e `regras.js` continuam iguais.

### Delegação de eventos

Em vez de um `onclick` em cada botão de editar ou excluir, há um único listener na lista (`tratarCliqueNaLista`) que descobre qual botão foi clicado pelo atributo `data-acao`. Isso funciona para itens criados depois e evita código no HTML gerado.

## 4. Outras práticas

- **Imutabilidade:** `adicionarMovimentacao`, `editarMovimentacao`, `excluirMovimentacao` e `ordenarHistorico` devolvem uma lista nova em vez de alterar a original. Os testes verificam isso.
- **Constantes no lugar de valores soltos:** `TIPO`, `LIMITES`, `FILTRO_TODOS` e `FILTRO_SEM` ficam em um único lugar. Os valores internos dos filtros de categoria (`"__todas__"`, `"__sem__"`) não podem ser confundidos com uma categoria digitada pelo usuário.
- **Grafia única:** se já existe "Alimentação" e o usuário digita "alimentação", a grafia existente é reaproveitada (`aplicarGrafiaExistente`), para não criar categorias repetidas no filtro.
- **Uma validação para tudo:** o formulário (registrar e editar) e a importação de arquivo usam a mesma função `validarMovimentacao`.
- **Temas com variáveis CSS:** as regras do `style.css` usam só variáveis por função (`--superficie`, `--destaque`, `--texto-suave`...). O tema noturno é um único bloco `:root[data-tema="escuro"]` que troca os valores, sem repetir nenhuma regra. O tema é aplicado no `<head>`, antes de a página aparecer, para não piscar.
- **Segurança:** o texto digitado pelo usuário é exibido com `textContent`, nunca com `innerHTML`, para não ser interpretado como HTML.
- **Compatibilidade com dados antigos:** movimentações e arquivos exportados antes das categorias continuam funcionando (`normalizarMovimentacao` preenche os campos vazios) e aparecem em "Sem categoria".

## 5. Defeitos encontrados e corrigidos

| Defeito | Causa | Correção | Teste que garante |
|---|---|---|---|
| Saldo zerado aparecia como "-R$ 0,00" em vermelho (ex.: entrada de 0,30, saídas de 0,10 e 0,20) | Em JavaScript, `0.1 + 0.2 = 0.30000000000000004` | Os valores são somados em centavos (números inteiros) e convertidos no final | "saldo zerado com centavos não fica negativo" |
| Datas impossíveis, como `2026-13-45`, eram aceitas na importação, e o filtro de mês mostrava "undefined de 2026" | A validação só conferia o formato com regex | `dataValida` confere se a data existe no calendário | "recusa datas que não existem no calendário" |
| Durante a refatoração, filtrar informando só parte dos filtros escondia todas as movimentações | Mistura das chaves `TIPO` (constante) e `tipo` (filtro) | Função `completarFiltros` | "sem filtros, mostra tudo" (o teste encontrou o defeito antes do merge) |

## 6. Ferramentas de qualidade

- **Testes:** `npm test` (pasta `tests/`, executor nativo do Node)
- **Lint:** `npm run lint` (ESLint). Regras do projeto: `eqeqeq` (sempre `===`), `no-var`, `prefer-const`, `no-unused-vars`
- **Pipeline:** `azure-pipelines.yml` roda as duas verificações em todo PR; o resultado dos testes aparece na aba **Tests** do pipeline

## 7. Evidências de code review

<!-- Preencher durante a sprint com os PRs em que a revisão gerou mudanças -->

| PR | O que o revisor apontou | O que mudou |
|---|---|---|
| !<número> | | |
| !<número> | | |
| !<número> | | |
