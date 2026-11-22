# Radar Byakugan

MVP estático de um painel de chuva para o Rio de Janeiro, com foco no Radar do Sumaré (Alerta Rio) e camada de radar do RainViewer.

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

O catálogo do RainViewer identifica o Radar do Sumaré como `BRSE` e lista o Alerta Rio entre as fontes brasileiras. A API pública de Weather Maps entrega tiles compostos de radar; neste MVP o mapa é centralizado no Sumaré, mostra o marcador/alcance da estação e usa os frames atuais da API. Uma próxima evolução pode adicionar um proxy para normalizar o arquivo bruto da estação e separar a camada exclusivamente do Sumaré quando esse fluxo estiver disponível.

## Próximas evoluções

1. Filtro por bairros e favoritos.
2. Estações pluviométricas do Alerta Rio.
3. Alertas de chuva por localização.
4. PWA com cache e modo de conectividade limitada.
