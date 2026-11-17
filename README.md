# 🪙 Coinn

Aplicação web de finanças pessoais para registrar entradas e saídas de dinheiro, acompanhar o saldo e consultar o histórico de movimentações, sem cadastro e sem login.

Projeto desenvolvido pela equipe **Ministério da Fazenda** na disciplina de Engenharia de Software da UNISINOS.

## Funcionalidades

Versão atual: **1.3.0**: MVP ampliado da Sprint 4, com relatórios, exportar/importar por período, gerenciador de categorias e movimentações recorrentes

- **Registrar movimentação** (#17): entrada ou saída, com valor, data, descrição, categoria e subcategoria
- **Consultar saldo** (#18): saldo atual, total de entradas e total de saídas
- **Ver histórico** (#19): lista da movimentação mais recente para a mais antiga
- **Editar e excluir** (#20): com confirmação antes de excluir
- **Excluir várias**: caixinha de seleção em cada movimentação do histórico, com "Selecionar todas" e "Excluir selecionadas" (com confirmação)
- **Limpar tudo** (#59): apaga todas as movimentações, com confirmação
- **Exportar e importar** (#21): cópia de segurança em arquivo `.json`
  - **Exportar por período** (#73): tudo, um mês, vários meses ou um ano
  - **Exportar e remover** (#74): tira um período que já terminou da Coinn para liberar espaço, guardando um "Ajuste de saldo" para o saldo não mudar
  - **Importar incorporando** (#75): escolhe o período do arquivo e junta com os dados atuais (só o que é novo; conflitos são mostrados para o usuário decidir), ou substitui só aquele período, ou tudo
- **Ocultar valores** (#56): botão de olho para usar o Coinn em público
- **Modo noturno**: botão de lua/sol na barra do topo alterna entre o tema claro (laranja) e o noturno (roxo, cinza e preto); a escolha fica salva
- **Categorias e subcategorias** (#57): opcionais (ex.: Alimentação › Mercado). Os botões **Selecionar** do formulário abrem o **gerenciador de categorias** (#83), para escolher, **criar**, **renomear** (✎) e **excluir** (×). Renomear troca o nome em todas as movimentações; excluir deixa as movimentações sem categoria (elas não são apagadas)
- **Filtros do histórico** (#58): por tipo, mês, categoria e subcategoria, combináveis, com o total do período filtrado. Na visão Geral, o filtro **Quando** (#81) mostra **só as futuras** (da mais próxima para a mais distante) ou só as que já aconteceram
- **30 de cada vez** (#82): o histórico mostra 30 movimentações; no fim da lista, **Carregar mais** traz as próximas 30
- **Movimentações futuras**: com data depois de hoje, aparecem em **amarelo** (#80) e não entram no saldo atual, só no **saldo previsto**; no dia da data passam a contar sozinhas
- **Repetir todo mês** (#84): ao registrar, escolha quantas vezes (de 2 a 120) e a Coinn cria uma movimentação por mês, no mesmo dia (no último dia do mês, se o dia não existir). Ao editar ou excluir uma parcela, dá para aplicar **só nela** ou **nela e nas próximas**
- **Visão Geral e Mensal**: a Geral mostra tudo; a Mensal mostra um mês por vez (‹ Novembro de 2026 ›), com entradas e saídas do mês, saldo no início e saldo previsto para o fim do mês
- **Filtro De/Até**: nos filtros do histórico da visão Mensal, mostra só as movimentações de um intervalo de datas (inclusive um dia só, e atravessando meses), com entradas, saídas, resultado e o saldo previsto na data final. O card de saldo e o mês continuam iguais
- **Relatórios** (#76 e #77): aba "Relatórios" com o período à escolha (mês, vários meses, ano, últimos 12 meses ou tudo), totais e comparação com o período anterior, gráficos de **entradas por mês**, **saídas por mês** e **saldo no fim de cada mês**, informações gerais (médias, taxa de economia...), destaques, gastos e entradas por categoria, maiores saídas, tabela mês a mês, planilha CSV e impressão/PDF

## Como executar

O Coinn não precisa de instalação, servidor ou banco de dados.

1. Clone o repositório:
   ```
   git clone <URL-DO-REPOSITORIO>
   ```
2. Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox).

Também é possível usar a extensão **Live Server** do VS Code: clique com o botão direito em `index.html` e escolha **Open with Live Server**.

## Testes e qualidade de código

Para rodar os testes e o lint é preciso ter o [Node.js](https://nodejs.org/) 20 ou mais novo. O site em si não usa o Node; ele só serve para essas verificações.

```
npm install        # instala o ESLint (só na primeira vez)
npm test           # roda os testes automatizados
npm run lint       # verifica o padrão do código
```

- **Testes automatizados** ficam na pasta `tests/` e usam o executor de testes nativo do Node (`node:test`). Eles cobrem as regras de negócio (`js/regras.js`), os cálculos dos relatórios (`js/relatorios.js`) e a camada de armazenamento (`js/storage.js`).
- **ESLint** verifica erros comuns e o padrão do código, com as regras em `eslint.config.js`.
- **Pipeline (Azure Pipelines)** roda tudo isso automaticamente em todo Pull Request, e o merge só é liberado se passar.

## Como os dados são guardados

As movimentações ficam salvas no **localStorage** do navegador, na chave `coinn.movimentacoes`. As preferências ficam em `coinn.valoresVisiveis` (olho) e `coinn.tema` (claro ou noturno). Isso significa que:

- os dados ficam apenas no computador e no navegador de quem usa;
- nada é enviado para a internet;
- limpar os dados de navegação, ou usar outro navegador, faz os dados não aparecerem. Use **Exportar dados** para guardar uma cópia.

### Modelo de dados

Cada movimentação é salva assim:

```json
{
  "id": 1792005471997,
  "tipo": "saida",
  "valor": 450.5,
  "data": "2026-10-12",
  "descricao": "Mercado",
  "categoria": "Alimentação",
  "subcategoria": "Mercado",
  "dataModificacao": "2026-10-28T21:23:57.185Z"
}
```

| Campo | Descrição |
|---|---|
| `id` | Identificador único, gerado com `Date.now()` |
| `tipo` | `"entrada"` ou `"saida"` |
| `valor` | Número positivo, de 0,01 a 999.999,99 |
| `data` | Data no formato `AAAA-MM-DD` |
| `descricao` | Texto de até 30 caracteres |
| `categoria` | Texto opcional, até 20 caracteres, escolhido no gerenciador de categorias (`""` quando não informada) |
| `subcategoria` | Texto livre e opcional, até 20 caracteres. Só existe se houver categoria |
| `dataModificacao` | Só existe se a movimentação foi editada: data e hora da última alteração |
| `ajuste` | Só existe no "Ajuste de saldo" criado ao exportar e remover um período: `{ inicio, fim, quantidade }` |
| `recorrencia` | Só existe nas movimentações criadas com "Repetir todo mês": `{ grupo, parcela, total }` |

O saldo não é armazenado: ele é calculado a partir das movimentações sempre que a tela é atualizada. Movimentações com data depois de hoje entram só no saldo previsto.

As categorias cadastradas no gerenciador ficam à parte, na chave `coinn.categorias` (veja `docs/modelo-de-dados.md`).

## Estrutura do projeto

```
Coinn/
├── README.md
├── index.html            Página principal
├── css/
│   └── style.css         Estilos da aplicação
├── js/
│   ├── regras.js         Regras de negócio (funções puras, testáveis)
│   ├── relatorios.js     Cálculos dos relatórios (funções puras, testáveis)
│   ├── graficos.js       Gráficos dos relatórios em SVG
│   ├── storage.js        Leitura e gravação no localStorage
│   └── app.js            Interface: formulário, lista, botões, relatórios, diálogos
├── img/                  Imagens e ícones
├── tests/                Testes automatizados
├── docs/                 Documentação complementar
├── azure-pipelines.yml   Pipeline de CI
├── eslint.config.js      Regras do ESLint
└── package.json          Scripts de teste e lint
```

Cada arquivo de `js/` tem uma única responsabilidade. A explicação completa está em `docs/qualidade-e-design.md`.

## Tecnologias

- HTML5, CSS3 e JavaScript puro (sem frameworks)
- localStorage do navegador
- Node.js (`node:test`) e ESLint, só para testes e qualidade de código
- Azure DevOps: Boards, Repos, Wiki e Pipelines

## Documentação

A documentação completa está na **Wiki** do projeto no Azure DevOps:

- Visão do produto (Sprint 0)
- Persona, jornada e user stories (Sprint 1)
- Diagramas C4 e modelo de dados (Sprint 2)
- ADR 01: Aplicação client-side com localStorage
- ADR 02: Exportação e importação de backup
- Estratégia de branches e como contribuir
- Qualidade e design do código (Sprint 4)
- Roteiro de testes manuais (Sprint 4)

<!-- Substitua pelo link da Wiki: -->
Link: <URL-DA-WIKI>

## Como contribuir

1. Atualize a `main`: `git switch main` e `git pull`
2. Crie uma branch para a story: `git switch -c feature/nome-da-funcionalidade`
3. Antes de enviar, rode `npm test` e `npm run lint`
4. Faça commits curtos com prefixo e número da story, por exemplo `feat: adiciona filtro por categoria #58`
5. Envie a branch: `git push -u origin feature/nome-da-funcionalidade`
6. Abra um Pull Request para a `main`, com o número da story no título, e peça a revisão de um colega

A `main` é protegida: toda alteração entra por Pull Request, com pelo menos uma aprovação e com o pipeline passando. Os detalhes estão na página **Estratégia de Branches e Como Contribuir** da Wiki.

## Equipe

| Nome | Papel |
|---|---|
| Arthur Ferreira da Silva | Desenvolvimento |
| João Pedro Adam da Silva de Souza | Product Owner |
| Lucas Ávila Kautzmanni | Scrum Master |
| Leonardo Fernandes | Desenvolvimento |
| Vitório de Conto Barbosa | Desenvolvimento |
