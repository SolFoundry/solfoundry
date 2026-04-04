import { FNDRYPriceWidget } from './components/FNDRYPriceWidget';

function App() {
  return (
    <main className="demo-shell">
      <section className="hero">
        <p className="eyebrow">SolFoundry</p>
        <h1>FNDRY Price Widget</h1>
        <p className="hero-copy">
          Embeddable React widget with DexScreener live pricing, change indicators,
          adaptive sizing, and session-based sparkline history.
        </p>
      </section>

      <section className="demo-grid">
        <article className="demo-card">
          <h2>Small</h2>
          <FNDRYPriceWidget size="small" updateInterval={15000} />
        </article>

        <article className="demo-card">
          <h2>Medium</h2>
          <FNDRYPriceWidget size="medium" updateInterval={15000} />
        </article>

        <article className="demo-card demo-card-wide">
          <h2>Large</h2>
          <FNDRYPriceWidget size="large" theme="dark" updateInterval={15000} />
        </article>
      </section>
    </main>
  );
}

export default App;
