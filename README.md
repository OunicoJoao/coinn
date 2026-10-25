# 🪙 Coinn

Aplicação web de finanças pessoais para registrar entradas e saídas de dinheiro, acompanhar o saldo e consultar o histórico de movimentações, sem cadastro e sem login.

Projeto desenvolvido pela equipe **Ministério da Fazenda** na disciplina de Engenharia de Software da UNISINOS.

## Funcionalidades

Versão atual: **MVP (Sprint 3)**

- **Registrar movimentação** (#17): entrada ou saída, com valor, data e descrição.
- **Consultar saldo** (#18): saldo atual, total de entradas e total de saídas.
- **Ver histórico** (#19): lista das movimentações, da mais recente para a mais antiga.

Próximas versões:

- Editar e excluir movimentações (#20)
- Exportar relatório e fazer backup dos dados (#21)

## Como executar

O Coinn não precisa de instalação, servidor ou banco de dados.

1. Clone o repositório:
   ```
   git clone <URL-DO-REPOSITORIO>
   ```
2. Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox).

Também é possível usar a extensão **Live Server** do VS Code: clique com o botão direito em `index.html` e escolha **Open with Live Server**.

## Como os dados são guardados

As movimentações ficam salvas no **localStorage** do navegador, na chave `coinn.movimentacoes`. Isso significa que:

- os dados ficam apenas no computador e no navegador de quem usa;
- nada é enviado para a internet;
- limpar os dados de navegação, ou usar outro navegador, faz os dados não aparecerem.

Para apagar os dados durante os testes, abra o console do navegador (F12) e rode:

```js
localStorage.removeItem("coinn.movimentacoes")
```

### Modelo de dados

Cada movimentação é salva assim:

```json
{
  "id": 1792005471997,
  "tipo": "entrada",
  "valor": 2500.5,
  "data": "2026-10-01",
  "descricao": "Salário"
}
```

| Campo | Descrição |
|---|---|
| `id` | Identificador único, gerado com `Date.now()` |
| `tipo` | `"entrada"` ou `"saida"` |
| `valor` | Número positivo, de 0,01 a 999.999,99 |
| `data` | Data no formato `AAAA-MM-DD` |
| `descricao` | Texto de até 30 caracteres |

O saldo não é armazenado: ele é calculado a partir das movimentações sempre que a tela é atualizada.

## Estrutura do projeto

```
Coinn/
├── README.md
├── index.html        Página principal
├── css/
│   └── style.css     Estilos da aplicação
├── js/
│   ├── storage.js    Leitura e gravação no localStorage
│   └── app.js        Lógica da interface
├── img/              Imagens e ícones
└── docs/             Documentação complementar
```

## Tecnologias

- HTML5, CSS3 e JavaScript puro (sem frameworks)
- localStorage do navegador
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
3. Faça commits curtos com prefixo e número da story, por exemplo `feat: adiciona filtro por mês #22`
4. Envie a branch: `git push -u origin feature/nome-da-funcionalidade`
5. Abra um Pull Request para a `main`, com o número da story no título, e peça a revisão de um colega

A `main` é protegida: toda alteração entra por Pull Request com pelo menos uma aprovação. Os detalhes estão na página **Estratégia de Branches e Como Contribuir** da Wiki.

## Equipe

| Nome | Papel |
|---|---|
| <!-- Nome --> | <!-- Ex.: Desenvolvimento --> |
| <!-- Nome --> | <!-- Ex.: Revisão de código e testes --> |
| <!-- Nome --> | <!-- Ex.: Documentação e Wiki --> |
| <!-- Nome --> | <!-- Ex.: Infraestrutura e Pipeline --> |

Pocou