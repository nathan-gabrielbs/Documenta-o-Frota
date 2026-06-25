# Migração do banco do projeto para Neon

Este projeto não usa mais Firebase nem dados operacionais embutidos em CSV/código. Placas, empresas, documentos, vencimentos, usuários e auditorias devem ser carregados do Neon pela API Express.

## Etapas recomendadas

1. Criar o banco PostgreSQL no Neon e copiar a connection string.
2. Configurar `DATABASE_URL` no ambiente do servidor com a connection string do Neon.
3. Executar o schema `db/001_neon_schema.sql` no Neon ou iniciar o servidor para criação automática da tabela `app_records`.
4. Migrar os dados oficiais para as coleções `empresas`, `usuarios`, `veiculos`, `documentos` e `auditoria` usando a API `PUT /api/:collection`.
5. Validar a conexão com `GET /api/health`.
6. Validar a carga no front-end: dashboards, listagens de veículos, documentos, usuários e relatórios precisam refletir exclusivamente o Neon.

## Formato de integração

A API armazena registros JSON por coleção na tabela `app_records`. Cada registro precisa conter `id`.

```http
PUT /api/veiculos
Content-Type: application/json

{
  "records": [
    {
      "id": "veiculo-1",
      "placa": "AAA0A00",
      "empresaId": "EMPRESA",
      "tipoUnidade": "Cavalo",
      "modelo": "Modelo",
      "ano": 2026,
      "renavam": "",
      "status": "ativo",
      "criadoPor": "Importação Neon",
      "atualizadoPor": "Importação Neon",
      "dataCadastro": "2026-06-25T00:00:00.000Z",
      "dataAtualizacao": "2026-06-25T00:00:00.000Z"
    }
  ]
}
```

> O exemplo acima é apenas estrutural. Use somente dados oficiais vindos da migração para popular o Neon.
