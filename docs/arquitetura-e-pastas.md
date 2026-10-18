# Arquitetura, Organização de Pastas e Pipeline GitHub Pages

Este documento descreve a organização de pastas do projeto, a separação de responsabilidades e o funcionamento da pipeline de atualização automática para o **GitHub Pages**.

---

## 1. Estrutura de Pastas do Projeto

```text
MercadoLivreApp/
├── app/                              # Roteamento e estilos globais (Next.js App Router)
│   ├── globals.css                   # Estilos globais do dashboard, filtros, cards e paginação
│   ├── layout.tsx                    # Layout raiz HTML (pt-BR)
│   └── page.tsx                      # Server Component que carrega o snapshot JSON (ou fallback ao vivo)
│
├── components/                       # Componentes de interface modulares (React 19 Client Components)
│   └── dashboard/
│       ├── DashboardClient.tsx       # Orquestrador de estado (filtros, busca, ordenação, paginação)
│       ├── ControlPanel.tsx          # Barra de menus interativos, filtros rápidos, sliders e KPIs
│       ├── ProductCard.tsx           # Card completo do produto (ficha, demanda, financeiro, vendedor)
│       ├── PaginationBar.tsx         # Controles de paginação (topo e rodapé)
│       ├── MethodologyPanel.tsx      # Painel explicativo das fórmulas e endpoints
│       └── formatters.ts             # Formatadores de moeda (BRL), números e tipos de filtro/ordenação
│
├── lib/                              # Camada de domínio, cliente da API e fórmulas matemáticas
│   ├── meli.ts                       # Barrel de re-exportação (@/lib/meli)
│   └── meli/
│       ├── index.ts                  # Exportações unificadas do módulo
│       ├── types.ts                  # Tipagens TypeScript (Product, Category, MeliSnapshot, etc.)
│       ├── client.ts                 # Autenticação OAuth 2.0, cache em memória e pool de concorrência
│       ├── formulas.ts               # Fórmulas de estimativa de vendas e cálculo financeiro/margem
│       └── service.ts                # Enriquecimento cruzado de produtos e geração do snapshot
│
├── public/                           # Arquivos estáticos públicos
│   └── data/
│       └── meli-snapshot.json        # Snapshot completo com 32 categorias e 560 produtos enriquecidos
│
├── scripts/                          # Scripts de linha de comando e automação
│   ├── update-data.ts                # Coleta todas as 32 categorias da API e atualiza meli-snapshot.json
│   ├── list-mcp-tools.mjs            # Testa conexão e lista as tools do servidor MCP do Mercado Livre
│   └── meli-login.mjs                # Fluxo OAuth 2.0 de usuário com PKCE em 2 passos (start / finish)
│
├── docs/                             # Documentação técnica completa do projeto
│   ├── README.md                     # Índice da documentação
│   ├── formulas-e-estimativas.md     # Fórmulas matemáticas e financeiras detalhadas
│   ├── api-mercado-livre.md          # Mapa auditado dos endpoints da API do Mercado Livre
│   ├── arquitetura-e-pastas.md       # Este documento
│   └── mcp-server.md                 # Configuração e uso do MCP Server oficial do Mercado Livre
│
├── .github/
│   └── workflows/
│       └── deploy-pages.yml          # Pipeline CI/CD (atualiza snapshot + build estático na main)
│
├── .npmrc                            # Trava o registry oficial (https://registry.npmjs.org/)
├── next.config.mjs                   # Configura output: "export" e basePath para o GitHub Pages
├── package.json                      # Scripts e dependências do projeto
└── tsconfig.json                     # Configuração do TypeScript
```

---

## 2. Fluxo de Dados e Publicação no GitHub Pages

Como o **GitHub Pages** hospeda arquivos estáticos (sem servidor Node.js em tempo de execução e sem expor `MELI_CLIENT_SECRET` no navegador), a arquitetura funciona em **2 etapas**:

1. **Coleta e Enriquecimento (`npm run update-data` / `scripts/update-data.ts`):**
   - Autentica na API do Mercado Livre via `POST /oauth/token`.
   - Percorre as **32 categorias raiz** do Brasil (`MLB`), coletando os 20 produtos mais vendidos de cada categoria (`560 produtos` no total), suas ofertas, tarifas oficiais, custos de frete, perguntas, reputação do vendedor e tendências de busca.
   - Aplica as fórmulas de [`lib/meli/formulas.ts`](../lib/meli/formulas.ts) e grava o arquivo [`public/data/meli-snapshot.json`](../public/data/meli-snapshot.json).

2. **Build Estático Direto na Branch `main` (`npm run build`):**
   - O Next.js (`output: "export"`) pré-renderiza a aplicação embutindo o snapshot e copia `index.html`, `404.html`, `_next/` e `.nojekyll` para a raiz da branch `main`.
   - O GitHub Pages serve diretamente a raiz da branch `main` em:
     **https://lucaszampronio.github.io/MercadoLivreApp/**
   - No navegador, o usuário filtra, pesquisa, pagina, ordena e simula alíquotas de **Imposto (%)** e **CMV (%)** instantaneamente (0 ms de latência de rede).

---

## 3. Pipeline Automática (`.github/workflows/deploy-pages.yml`)

A pipeline do GitHub Actions é executada:
- **Automaticamente a cada 6 horas** (`cron: "0 */6 * * *"`),
- **Manualmente** através do botão **Run workflow** na aba *Actions* do GitHub.

Passos executados pelo job `update-main`:
1. Faz checkout da branch `main` e instala as dependências a partir do registry oficial (`https://registry.npmjs.org`).
2. Se os secrets `MELI_APP_ID` e `MELI_CLIENT_SECRET` estiverem configurados no repositório, roda `npm run update-data` para atualizar `public/data/meli-snapshot.json`.
3. Roda `npm run build` para atualizar `index.html` e `_next/` na raiz da branch `main`.
4. Faz commit e `git push origin main` automaticamente caso haja novos dados.
