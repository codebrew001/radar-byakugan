# Radar Byakugan

MVP estático de um painel de chuva para o Brasil, com dados compostos de múltiplos radares do RainViewer.

## Escolha técnica

- HTML sem framework para manter o deploy simples e barato.
- CSS puro para a interface responsiva.
- JavaScript moderno no navegador para buscar os frames e controlar o mapa.
- [Leaflet](https://leafletjs.com/) + [MapLibre GL JS](https://maplibre.org/) via CDN.
- [RainViewer Weather Maps API](https://www.rainviewer.com/api/weather-maps-api.html) para os frames de radar.
- [OpenFreeMap](https://openfreemap.org/) como base vetorial baseada em OpenStreetMap, sem API key.

O projeto não precisa de backend nem de chave de API no MVP. A pasta `dist/` já é um artefato estático publicável em GitHub Pages, Cloudflare Pages, Netlify ou qualquer CDN simples.

Os scripts do mapa usam builds compatíveis com abertura direta do `index.html` no navegador. Para desenvolvimento, ainda é recomendado servir a pasta via HTTP para evitar restrições do navegador com outras APIs.

## Rodar localmente

Como o navegador pode bloquear requisições de arquivos `file://`, sirva a pasta `dist` com qualquer servidor HTTP:

```bash
python -m http.server 8080 --directory dist
```

Depois abra `http://localhost:8080`.

## Nota sobre a fonte do radar

A API pública de Weather Maps do RainViewer entrega tiles compostos de radar. Neste MVP, o mapa inicia centralizado no Rio de Janeiro, permite navegar pelas 27 capitais brasileiras e usa os frames mais recentes disponíveis para o mosaico nacional. A camada não representa exclusivamente uma estação individual.

## Próximas evoluções

1. Filtros por região, bairros e favoritos.
2. Estações pluviométricas e dados observados.
3. Alertas de chuva por localização.
4. PWA com cache e modo de conectividade limitada.
