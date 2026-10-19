"use client";

export default function MethodologyPanel() {
  return (
    <section className="method-box">
      <h3>Como cada métrica estilo Avantpro é obtida e calculada?</h3>
      <div className="method-grid">
        <div>
          <strong>1. Datas Reais de Criação (Anúncio vs. Catálogo)</strong>
          <p>
            • <strong>Catálogo criado em:</strong> 100% oficial via{" "}
            <code>GET /products/&#123;id&#125;</code> (campo <code>date_created</code>).
            <br />• <strong>Anúncio criado em:</strong> embora <code>GET /items/&#123;id&#125;</code>{" "}
            seja bloqueado (403), o sub-recurso{" "}
            <code>GET /items/&#123;id&#125;/description</code> retorna <code>200 OK</code> com o{" "}
            <code>date_created</code> exato do anúncio vencedor do Buy Box (<code>offers[0]</code>).
            Caso o anúncio não tenha texto de descrição, interpolamos a data pela curva monotônica
            do ID sequencial <code>MLB&#123;id&#125;</code>.
          </p>
        </div>

        <div>
          <strong>2. Faixa de Vendidos, Vendas Estimadas e Ritmo Atual</strong>
          <p>
            • <strong>Faixa de Vendidos (+Vendidos):</strong> calculada pelo volume acumulado ao
            longo dos dias ativos do catálogo/anúncio e mapeada para os degraus oficiais do ML (
            <code>50.000</code>, <code>10.000</code>, <code>5.000</code>, <code>1.000</code>,{" "}
            <code>500</code>, <code>100</code>...).
            <br />• <strong>Vendas estimadas:</strong> aplica o fator{" "}
            <code>Vendidos × 1,35</code> (ou <code>Perguntas × 8</code> quando superior).
            <br />• <strong>Vendas por dia e Vendas mensais:</strong> média histórica desde a
            criação (<code>Vendidos ÷ Dias ativos</code> e <code>Vendidos ÷ Meses ativos</code>).
            <br />• <strong>Ritmo atual (vendas/mês):</strong> velocidade nos últimos 30 dias
            ponderando posição no Top 20, número de ofertas no catálogo, Full e perguntas recentes.
          </p>
        </div>

        <div>
          <strong>3. Visitas Acumuladas, % Conversão e Estoque</strong>
          <p>
            • <strong>% Conversão:</strong> calculada pela atratividade do Buy Box (posição{" "}
            <code>#1..#20</code>, logística <code>Full</code>, <code>Frete Grátis</code> e{" "}
            <code>Loja Oficial</code>), variando tipicamente entre <code>9,5%</code> e{" "}
            <code>14,0%</code> nos líderes de categoria.
            <br />• <strong>Visitas:</strong> <code>Vendidos ÷ (% Conversão ÷ 100)</code>.
            <br />• <strong>Faturando R$:</strong> faturamento bruto acumulado (
            <code>Vendidos × Preço Buy Box</code>) + ritmo mensal atual.
          </p>
        </div>

        <div>
          <strong>4. Comissão ML, Frete, Imposto, Recebe e Recomendação</strong>
          <p>
            • <strong>Comissão ML e Frete:</strong> 100% oficiais via{" "}
            <code>/sites/MLB/listing_prices</code> e{" "}
            <code>/users/&#123;seller&#125;/shipping_options/free</code>.
            <br />• <strong>Recebe:</strong>{" "}
            <code>Preço - Comissão ML - Frete - Imposto (padrão 7%)</code> e percentual líquido sobre
            a venda.
            <br />• <strong>Recomendação:</strong> faixa recomendada de custo de compra do produto
            (fornecedor/CMV) entre <strong>50% e 90% do valor Recebe</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}
