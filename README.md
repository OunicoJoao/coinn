# 🪙 Coinn

Aplicação web de finanças pessoais para registrar entradas e saídas de dinheiro, acompanhar o saldo e consultar o histórico de movimentações, sem cadastro e sem login.

Projeto desenvolvido pela equipe **Ministério da Fazenda** na disciplina de Engenharia de Software da UNISINOS.

## Funcionalidades

Versão atual: **MVP ampliado (Sprint 4)**

- **Registrar movimentação** (#17): entrada ou saída, com valor, data, descrição, categoria e subcategoria
- **Consultar saldo** (#18): saldo atual, total de entradas e total de saídas
- **Ver histórico** (#19): lista da movimentação mais recente para a mais antiga
- **Editar e excluir** (#20): com confirmação antes de excluir
- **Limpar tudo** (#59): apaga todas as movimentações, com confirmação
- **Exportar e importar** (#21): cópia de segurança em arquivo `.json`
- **Ocultar valores** (#56): botão de olho para usar o Coinn em público
- **Categorias e subcategorias** (#57): texto livre e opcional (ex.: Alimentação › Mercado), com sugestões do que já foi usado
- **Filtros do histórico** (#58): por tipo, mês, categoria e subcategoria, combináveis, com o total do período filtrado

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

- **Testes automatizados** ficam na pasta `tests/` e usam o executor de testes nativo do Node (`node:test`). Eles cobrem as regras de negócio (`js/regras.js`) e a camada de armazenamento (`js/storage.js`).
- **ESLint** verifica erros comuns e o padrão do código, com as regras em `eslint.config.js`.
- **Pipeline (Azure Pipelines)** roda tudo isso automaticamente em todo Pull Request, e o merge só é liberado se passar.

## Como os dados são guardados

As movimentações ficam salvas no **localStorage** do navegador, na chave `coinn.movimentacoes`. A preferência do botão de olho fica em `coinn.valoresVisiveis`. Isso significa que:

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
| `categoria` | Texto livre e opcional, até 20 caracteres (`""` quando não informada) |
| `subcategoria` | Texto livre e opcional, até 20 caracteres. Só existe se houver categoria |
| `dataModificacao` | Só existe se a movimentação foi editada: data e hora da última alteração |

O saldo não é armazenado: ele é calculado a partir das movimentações sempre que a tela é atualizada.

## Estrutura do projeto

```
Coinn/
├── README.md
├── index.html            Página principal
├── css/
│   └── style.css         Estilos da aplicação
├── js/
│   ├── regras.js         Regras de negócio (funções puras, testáveis)
│   ├── storage.js        Leitura e gravação no localStorage
│   └── app.js            Interface: formulário, lista, botões
├── img/                  Imagens e ícones
├── tests/                Testes automatizados
├── docs/                 Documentação complementar
├── azure-pipelines.yml   Pipeline de CI
├── eslint.config.js      Regras do ESLint
└── package.json          Scripts de teste e lint
```

Cada arquivo de `js/` tem uma única responsabilidade: `regras.js` decide, `storage.js` guarda e `app.js` mostra na tela.

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
