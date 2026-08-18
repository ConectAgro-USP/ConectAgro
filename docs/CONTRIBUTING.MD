# Guia de Contribuição - ConectAgro

Obrigado por contribuir com o ConectAgro! Este guia cobre as boas práticas para cada
tipo de contribuição.

## Boas Práticas

- Escreva títulos claros e concisos para Issues e PRs
- Evite duplicações, verifique se já existe uma issue/PR semelhante
- Uma issue ou PR por problema/funcionalidade
- Priorize código bem escrito e testado

## Processo de Contribuição

1. Abra uma issue descrevendo o que pretende fazer e aguarde feedback
2. Crie uma branch descritiva:
   - `fix/nome-do-bug` para correções
   - `feature/nome-da-funcionalidade` para novas features
   - `docs/descricao` para documentação
3. Implemente suas mudanças com commits atômicos e bem descritos
4. Rode as validações locais (`make lint` e `make test`)
5. Abra um Pull Request referenciando a issue original

## Commits

Use mensagens claras e descritivas:

```bash
fix: corrigir validação do formulário de login
feat: adicionar endpoint de listagem de produtores
docs: atualizar instruções de instalação
test: adicionar testes para o fluxo de autenticação
```

Commits devem ser atômicos, cada commit deve representar uma mudança lógica única.

## Comentários no Código

Escreva comentários que expliquem o "porquê", não o "o quê", o código já diz o que
está fazendo. Evite comentários óbvios ou temporários deixados no código.

## Testes

Sempre rode os testes antes de abrir um PR:

```bash
make lint
make test
```

Nenhum PR será aceito se o lint ou os testes não passarem.
