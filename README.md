# ERP Loja

Sistema único de gestão da loja: cadastros, vendas, estoque, caixa, financeiro, fiscal e entregas.

A especificação completa e as regras de negócio estão em [CLAUDE.md](CLAUDE.md).

## Colocar no ar (primeira vez)

1. **Banco (Supabase)** — no projeto do Supabase, abra *SQL Editor*, cole o conteúdo de
   `supabase/migrations/20261013000001_etapa1_base.sql` e execute.
2. **Variáveis** — em *Project Settings → API*, copie a *Project URL* e a chave *anon public*.
3. **Hospedagem (Vercel)** — importe este repositório em vercel.com, e em *Environment Variables* crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores acima. O deploy é automático a cada push.
4. **Endereço do site no Supabase** — em *Authentication → URL Configuration*, coloque o endereço da
   Vercel em *Site URL* (para os links de confirmação de e-mail e de nova senha funcionarem).
5. **Primeiro acesso** — abra o site, clique em *Solicitar acesso* e cadastre-se. O primeiro usuário
   vira **Administrador** automaticamente. Os próximos aparecem em *Administrativo › Usuários* para liberação.

## Rodar no computador (opcional)

```bash
npm install
cp .env.example .env   # e preencha os valores
npm run dev
```
