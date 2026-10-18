"use client";

export default function MethodologyPanel() {
  return (
    <section className="method-box">
      <h3>Como cada métrica e estimativa é calculada?</h3>
      <div className="method-grid">
        <div>
          <strong>1. Vendas Estimadas &amp; Ritmo/Dia</strong>
          <p>
            A API pública do Mercado Livre bloqueia o campo <code>sold_quantity</code> em{" "}
            <code>/items</code> com erro <code>403</code>. Para contornar isso com dados reais,
            consultamos <code>/questions/search?item=&#123;id&#125;</code>, que retorna o{" "}
            <strong>total exato de perguntas</strong> e a{" "}
            <strong>data das últimas 50 perguntas</strong>. No e-commerce brasileiro (ML), a taxa
            média é de <strong>~1 pergunta a cada 8 vendas</strong>. Combinamos a velocidade das
            perguntas recentes (60%) com a média desde a data de criação do catálogo{" "}
            <code>date_created</code> (40%). Quando uma oferta vencedora acabou de entrar no buybox
            e ainda tem 0 perguntas, aplicamos uma curva de Pareto (Lei de Zipf) baseada na posição{" "}
            <code>#1..#20</code> do ranking.
          </p>
        </div>
        <div>
          <strong>2. Tarifa ML, Frete e Líquido Recebido (100% Oficial)</strong>
          <p>
            Consultamos <code>/sites/MLB/listing_prices</code> passando o preço real, a
            subcategoria e o tipo do anúncio (<code>Clássico</code> ou <code>Premium</code>) para
            obter a <strong>comissão exata do ML em R$ e %</strong>. Em seguida, consultamos{" "}
            <code>/users/&#123;seller&#125;/shipping_options/free</code> para obter o{" "}
            <strong>peso faturável (g) e o custo de frete Mercado Envios</strong>. O recebimento
            líquido é: <code>Preço - Tarifa ML - Frete pago pelo vendedor</code>.
          </p>
        </div>
        <div>
          <strong>3. Simulador de Imposto, CMV e Faixa de Preço p/ Lucro</strong>
          <p>
            Você pode ajustar abaixo a alíquota de <strong>Imposto (%)</strong> e o{" "}
            <strong>Custo da Mercadoria / CMV (%)</strong>. A faixa de preço recomendada usa a
            fórmula inversa de precificação para atingir de{" "}
            <strong>15% a 25% de margem líquida</strong> livre após descontar comissão do ML, taxa
            fixa, frete e impostos:
            <br />
            <code>
              Preço Ideal = (Custo + Frete + Taxa Fixa) ÷ (1 - %TarifaML - %Imposto - %Margem)
            </code>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
